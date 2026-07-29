import type { AIGatewayPort } from '../../ports';
import {
  GenerateQuestionsRequestSchema,
  type AIGatewayFailure,
  type AIGatewaySuccess,
  type GenerateQuestionsRequest,
  type AIQuestionContext,
  type Language,
  type LearnerProfile,
  type LearnerSettingsDailyMinutes,
  type LearnerSettingsFocus,
  type CanonicalWord,
} from '../../schemas/v1';

export interface GenerateQuestionsRequestInput {
  readonly requestId: string;
  readonly language: Language;
  readonly targetCount: number;
  readonly manifestId: string;
  readonly contentVersion: number;
  readonly profile: LearnerProfile;
  readonly dailyMinutes: LearnerSettingsDailyMinutes;
  readonly focus: LearnerSettingsFocus;
  readonly words: readonly CanonicalWord[];
}

export type GenerateQuestionsOutcome =
  | {
      readonly status: 'success';
      readonly response: AIGatewaySuccess;
    }
  | {
      readonly status: 'fallback';
      readonly reason: 'gateway-not-configured' | AIGatewayFailure['error']['code'];
      readonly response: AIGatewayFailure | null;
    };

function toQuestionContext(word: CanonicalWord): AIQuestionContext {
  return {
    itemId: word.id,
    language: word.language,
    headword: word.headword,
    reading: word.reading,
    phonetic: word.phonetic,
    meaning: word.meaning,
    partOfSpeech: word.partOfSpeech,
    level: word.level,
    difficulty: word.difficulty,
    tags: word.tags.slice(0, 10),
  };
}

export function createGenerateQuestionsRequest(
  input: GenerateQuestionsRequestInput,
): GenerateQuestionsRequest {
  return GenerateQuestionsRequestSchema.parse({
    schemaVersion: 1,
    task: 'generateQuestions',
    requestId: input.requestId,
    language: input.language,
    targetCount: input.targetCount,
    profile: {
      language: input.profile.language,
      answeredCount: input.profile.answeredCount,
      accuracy: input.profile.accuracy,
      recentIncorrectItemIds: input.profile.recentIncorrectItemIds,
      recentTrend: input.profile.recentTrend,
      dailyMinutes: input.dailyMinutes,
      focus: input.focus,
    },
    content: {
      manifestId: input.manifestId,
      contentVersion: input.contentVersion,
      items: input.words.map(toQuestionContext),
    },
  });
}

export class GenerateQuestionsUseCase {
  readonly #gateway: AIGatewayPort | null;

  constructor(gateway: AIGatewayPort | null) {
    this.#gateway = gateway;
  }

  async execute(input: GenerateQuestionsRequestInput): Promise<GenerateQuestionsOutcome> {
    const request = createGenerateQuestionsRequest(input);

    if (!this.#gateway) {
      return {
        status: 'fallback',
        reason: 'gateway-not-configured',
        response: null,
      };
    }

    try {
      const response = await this.#gateway.generateQuestions(request);
      return response.status === 'success'
        ? { status: 'success', response }
        : { status: 'fallback', reason: response.error.code, response };
    } catch {
      return {
        status: 'fallback',
        reason: 'unavailable',
        response: null,
      };
    }
  }
}
