import { describe, expect, it, vi } from 'vitest';

import { createGenerateQuestionsRequest, GenerateQuestionsUseCase } from '../../src/application/ai';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import type { AIGatewayPort } from '../../src/ports';
import { LearnerProfileSchema } from '../../src/schemas/v1';
import {
  validGenerateQuestionsFailure,
  validGenerateQuestionsResponse,
} from '../fixtures/ai-task-protocol';

const profile = LearnerProfileSchema.parse({
  schemaVersion: 1,
  projectionVersion: 1,
  userId: 'ai-use-case-user',
  language: 'ja',
  answeredCount: 4,
  correctCount: 3,
  incorrectCount: 1,
  accuracy: 0.75,
  averageResponseTimeMs: null,
  recentIncorrectItemIds: [jaN5StarterWords[1].id],
  recentTrend: 'stable',
  projectedThrough: null,
});

const input = {
  requestId: 'ai-use-case-request',
  language: 'ja' as const,
  targetCount: 2,
  manifestId: jaN5StarterManifest.id,
  contentVersion: jaN5StarterManifest.contentVersion,
  profile,
  dailyMinutes: 5 as const,
  focus: 'review' as const,
  words: jaN5StarterWords.slice(0, 2),
};

describe('GenerateQuestionsUseCase', () => {
  it('builds the minimum versioned context from canonical words and profile summary', () => {
    expect(createGenerateQuestionsRequest(input)).toMatchObject({
      schemaVersion: 1,
      task: 'generateQuestions',
      requestId: 'ai-use-case-request',
      language: 'ja',
      targetCount: 2,
      profile: {
        language: 'ja',
        answeredCount: 4,
        accuracy: 0.75,
        recentIncorrectItemIds: [jaN5StarterWords[1].id],
        dailyMinutes: 5,
        focus: 'review',
      },
      content: {
        manifestId: jaN5StarterManifest.id,
        contentVersion: jaN5StarterManifest.contentVersion,
        items: [
          expect.objectContaining({
            itemId: jaN5StarterWords[0].id,
            headword: jaN5StarterWords[0].headword,
            reading: jaN5StarterWords[0].reading,
          }),
          expect.objectContaining({
            itemId: jaN5StarterWords[1].id,
            headword: jaN5StarterWords[1].headword,
            reading: jaN5StarterWords[1].reading,
          }),
        ],
      },
    });
  });

  it('returns a success outcome without persisting or transforming the result', async () => {
    const gateway: AIGatewayPort = {
      generateQuestions: vi.fn().mockResolvedValue(validGenerateQuestionsResponse),
    };
    const outcome = await new GenerateQuestionsUseCase(gateway).execute(input);

    expect(outcome).toEqual({ status: 'success', response: validGenerateQuestionsResponse });
    expect(gateway.generateQuestions).toHaveBeenCalledTimes(1);
  });

  it('falls back when Gateway is not configured or returns a stable failure', async () => {
    await expect(new GenerateQuestionsUseCase(null).execute(input)).resolves.toEqual({
      status: 'fallback',
      reason: 'gateway-not-configured',
      response: null,
    });

    const gateway: AIGatewayPort = {
      generateQuestions: vi.fn().mockResolvedValue(validGenerateQuestionsFailure),
    };
    await expect(new GenerateQuestionsUseCase(gateway).execute(input)).resolves.toEqual({
      status: 'fallback',
      reason: 'rate-limited',
      response: validGenerateQuestionsFailure,
    });
  });

  it('converts an unexpected port throw into a local fallback', async () => {
    const gateway: AIGatewayPort = {
      generateQuestions: vi.fn().mockRejectedValue(new Error('transport detail must stay local')),
    };

    await expect(new GenerateQuestionsUseCase(gateway).execute(input)).resolves.toEqual({
      status: 'fallback',
      reason: 'unavailable',
      response: null,
    });
  });
});
