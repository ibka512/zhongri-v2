import type { AIGatewayPort } from '../../ports';
import {
  AIGatewayResponseSchema,
  AIPromptVersion,
  GenerateQuestionsRequestSchema,
  parseGenerateQuestionsResponse,
  type AIGatewayResponse,
  type GenerateQuestionsRequest,
} from '../../schemas/v1';
import { IdentifierSchema } from '../../schemas/v1/shared';
import { normalizeAIGatewayBaseUrl } from './AIGatewayConfig';

const AI_GATEWAY_PATH = '/v1/tasks/generate-questions';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 120_000;

export interface AIGatewayHttpClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly gatewayVersion?: string | null;
  readonly createRequestId?: () => string;
  readonly now?: () => number;
}

function defaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function requestIdFromUnknown(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('requestId' in input)) {
    return null;
  }

  const requestId = (input as { requestId?: unknown }).requestId;
  if (typeof requestId !== 'string') {
    return null;
  }

  const trimmed = requestId.trim();
  return trimmed.length > 0 && trimmed.length <= 128 ? trimmed : null;
}

function safeGeneratedRequestId(createRequestId: () => string): string {
  try {
    const parsed = IdentifierSchema.safeParse(createRequestId());
    return parsed.success ? parsed.data : defaultRequestId();
  } catch {
    return defaultRequestId();
  }
}

function safeVersionToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(trimmed) ? trimmed : null;
}

function durationMs(startedAt: number, now: () => number): number {
  return Math.max(0, Math.round(now() - startedAt));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false;
}

export class AIGatewayHttpClient implements AIGatewayPort {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch | null;
  readonly #timeoutMs: number;
  readonly #gatewayVersion: string | null;
  readonly #createRequestId: () => string;
  readonly #now: () => number;

  constructor(options: AIGatewayHttpClientOptions) {
    this.#baseUrl = normalizeAIGatewayBaseUrl(options.baseUrl);
    this.#fetch =
      options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#gatewayVersion = safeVersionToken(options.gatewayVersion);
    this.#createRequestId = options.createRequestId ?? defaultRequestId;
    this.#now = options.now ?? Date.now;

    if (
      !Number.isInteger(this.#timeoutMs) ||
      this.#timeoutMs <= 0 ||
      this.#timeoutMs > MAX_TIMEOUT_MS
    ) {
      throw new Error(`AI gateway timeout must be an integer from 1 to ${MAX_TIMEOUT_MS} ms`);
    }
  }

  async generateQuestions(input: GenerateQuestionsRequest): Promise<AIGatewayResponse> {
    const startedAt = this.#now();
    const fallbackRequestId =
      requestIdFromUnknown(input) ?? safeGeneratedRequestId(this.#createRequestId);
    const parsedRequest = GenerateQuestionsRequestSchema.safeParse(input);

    if (!parsedRequest.success) {
      return this.#failure('invalid-request', fallbackRequestId, false, startedAt);
    }

    const request = parsedRequest.data;
    if (!this.#fetch) {
      return this.#failure('unavailable', request.requestId, true, startedAt);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);

    try {
      const response = await this.#fetch(`${this.#baseUrl}${AI_GATEWAY_PATH}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        const code = this.#failureCodeForStatus(response.status);
        return this.#failure(code, request.requestId, code !== 'invalid-request', startedAt);
      }

      if (!isJsonResponse(response)) {
        return this.#failure('invalid-response', request.requestId, false, startedAt);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return this.#failure('invalid-response', request.requestId, false, startedAt);
      }

      try {
        const validated = parseGenerateQuestionsResponse(payload, request);
        return AIGatewayResponseSchema.parse(validated);
      } catch {
        return this.#failure('invalid-response', request.requestId, false, startedAt);
      }
    } catch (error) {
      if (timedOut || isAbortError(error)) {
        return this.#failure('timeout', request.requestId, true, startedAt);
      }

      return this.#failure('unavailable', request.requestId, true, startedAt);
    } finally {
      clearTimeout(timeout);
    }
  }

  #failureCodeForStatus(
    status: number,
  ): 'invalid-request' | 'timeout' | 'rate-limited' | 'upstream' {
    if (status === 408 || status === 504) {
      return 'timeout';
    }

    if (status === 429) {
      return 'rate-limited';
    }

    if (status >= 400 && status < 500) {
      return 'invalid-request';
    }

    return 'upstream';
  }

  #failure(
    code:
      | 'invalid-request'
      | 'invalid-response'
      | 'unavailable'
      | 'timeout'
      | 'rate-limited'
      | 'upstream',
    requestId: string,
    retryable: boolean,
    startedAt: number,
  ): AIGatewayResponse {
    return {
      schemaVersion: 1,
      status: 'failure',
      task: 'generateQuestions',
      requestId,
      error: { code, retryable },
      trace: {
        requestId,
        schemaVersion: 1,
        task: 'generateQuestions',
        promptVersion: AIPromptVersion,
        model: null,
        gatewayVersion: this.#gatewayVersion,
        durationMs: durationMs(startedAt, this.#now),
      },
    };
  }
}

export function createAIGatewayHttpClient(options: AIGatewayHttpClientOptions): AIGatewayPort {
  return new AIGatewayHttpClient(options);
}
