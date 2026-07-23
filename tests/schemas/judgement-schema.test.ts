import { describe, expect, it } from 'vitest';

import { JudgementResultSchema, JudgementStatus } from '../../src/schemas/v1/JudgementSchema';

describe('JudgementResultSchema v1', () => {
  it('accepts an incorrect deterministic judgement', () => {
    const result = {
      schemaVersion: 1,
      questionId: 'question-ja-001',
      status: JudgementStatus.Incorrect,
      userAnswer: 'option-phone',
      expectedAnswer: 'option-clock',
      errorReason: {
        code: 'wrongOption',
        message: '选择的释义与标准答案不一致。',
      },
      feedbackText: '正确答案是“钟表”。',
      requiresAiExplanation: false,
    };

    expect(JudgementResultSchema.safeParse(result).success).toBe(true);
  });

  it('rejects an inconsistent correct result', () => {
    const result = {
      schemaVersion: 1,
      questionId: 'question-ja-001',
      status: JudgementStatus.Correct,
      userAnswer: 'option-clock',
      expectedAnswer: 'option-clock',
      errorReason: {
        code: 'wrongOption',
        message: '不应存在的错误原因。',
      },
      feedbackText: '回答正确。',
      requiresAiExplanation: false,
    };

    expect(JudgementResultSchema.safeParse(result).success).toBe(false);
  });
});
