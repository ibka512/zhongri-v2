import { describe, expect, it } from 'vitest';

import { judgeAnswer } from '../../src/domain/study';
import { japaneseVocabularyQuestions } from '../../src/mock/questions';
import { JudgementResultSchema, JudgementStatus } from '../../src/schemas/v1';

describe('judgeAnswer', () => {
  const question = japaneseVocabularyQuestions[0];

  if (!question) {
    throw new Error('Expected a mock question');
  }

  it('returns a valid correct judgement for the expected choice', () => {
    const result = judgeAnswer(question, 'neko');

    expect(JudgementResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe(JudgementStatus.Correct);
    expect(result.errorReason).toBeNull();
  });

  it('returns a valid incorrect judgement for a different choice', () => {
    const result = judgeAnswer(question, 'inu');

    expect(JudgementResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe(JudgementStatus.Incorrect);
    expect(result.errorReason?.code).toBe('choice_mismatch');
    expect(result.requiresAiExplanation).toBe(false);
  });
});
