import { describe, expect, it, vi } from 'vitest';

import {
  AIGatewayHttpClient,
  normalizeAIGatewayBaseUrl,
  readAIGatewayRuntimeConfig,
} from '../../src/infrastructure/ai';
import {
  validGenerateQuestionsRequest,
  validGenerateQuestionsResponse,
} from '../fixtures/ai-task-protocol';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AIGatewayHttpClient', () => {
  it('posts the versioned task to the fixed endpoint and validates success', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(validGenerateQuestionsResponse));
    const client = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test/',
      fetch: fetchMock,
      gatewayVersion: 'worker-v1',
      createRequestId: () => 'test-request-id',
    });

    await expect(client.generateQuestions(validGenerateQuestionsRequest)).resolves.toEqual(
      validGenerateQuestionsResponse,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gateway.example.test/v1/tasks/generate-questions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual(validGenerateQuestionsRequest);
  });

  it('rejects an invalid request before making a network call', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: fetchMock,
    });

    const result = await client.generateQuestions({
      ...validGenerateQuestionsRequest,
      prompt: 'not allowed',
    } as never);

    expect(result).toMatchObject({
      status: 'failure',
      requestId: validGenerateQuestionsRequest.requestId,
      error: { code: 'invalid-request', retryable: false },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [408, 'timeout', true],
    [429, 'rate-limited', true],
    [500, 'upstream', true],
    [400, 'invalid-request', true],
  ] as const)('maps HTTP %s to a stable failure', async (status, code) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ detail: 'secret upstream body' }, status));
    const client = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: fetchMock,
    });

    const result = await client.generateQuestions(validGenerateQuestionsRequest);

    expect(result).toMatchObject({
      status: 'failure',
      error: { code, retryable: code !== 'invalid-request' },
    });
    expect(JSON.stringify(result)).not.toContain('secret upstream body');
  });

  it('maps malformed JSON, non-JSON responses, and schema errors to invalid-response', async () => {
    const malformedJson = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"status":', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const malformedClient = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: malformedJson,
    });
    await expect(
      malformedClient.generateQuestions(validGenerateQuestionsRequest),
    ).resolves.toMatchObject({
      status: 'failure',
      error: { code: 'invalid-response', retryable: false },
    });

    const nonJson = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
      );
    const nonJsonClient = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: nonJson,
    });
    await expect(
      nonJsonClient.generateQuestions(validGenerateQuestionsRequest),
    ).resolves.toMatchObject({
      status: 'failure',
      error: { code: 'invalid-response', retryable: false },
    });

    const invalidSchema = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ ...validGenerateQuestionsResponse, extra: 'reject me' }));
    const invalidSchemaClient = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: invalidSchema,
    });
    await expect(
      invalidSchemaClient.generateQuestions(validGenerateQuestionsRequest),
    ).resolves.toMatchObject({
      status: 'failure',
      error: { code: 'invalid-response', retryable: false },
    });
  });

  it('maps network aborts and timeouts without throwing into the learning flow', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    const client = new AIGatewayHttpClient({
      baseUrl: 'https://gateway.example.test',
      fetch: fetchMock,
      timeoutMs: 5,
    });

    await expect(client.generateQuestions(validGenerateQuestionsRequest)).resolves.toMatchObject({
      status: 'failure',
      error: { code: 'timeout', retryable: true },
    });
  });
});

describe('AIGateway runtime URL configuration', () => {
  it('normalizes a public URL and omits an unset or unsafe URL', () => {
    expect(normalizeAIGatewayBaseUrl('https://gateway.example.test///')).toBe(
      'https://gateway.example.test',
    );
    expect(
      readAIGatewayRuntimeConfig({ VITE_AI_GATEWAY_URL: 'https://gateway.example.test/' }),
    ).toEqual({
      gatewayUrl: 'https://gateway.example.test',
    });
    expect(readAIGatewayRuntimeConfig({})).toEqual({ gatewayUrl: null });
    expect(
      readAIGatewayRuntimeConfig({ VITE_AI_GATEWAY_URL: 'https://user:pass@example.test' }),
    ).toEqual({
      gatewayUrl: null,
    });
  });
});
