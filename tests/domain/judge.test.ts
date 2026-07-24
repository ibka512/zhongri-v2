import { describe, expect, it } from 'vitest';

import { judgeAnswer } from '../../src/domain/study';
import { japaneseVocabularyQuestions } from '../../src/mock/questions';
import {
  JudgementResultSchema,
  JudgementStatus,
  QuestionSchema,
  QuestionType,
} from '../../src/schemas/v1';

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

  it('judges accepted text after applying the question normalization rules', () => {
    const textQuestion = QuestionSchema.parse({
      schemaVersion: 1,
      id: 'text-question',
      language: 'ja',
      type: QuestionType.TextInput,
      skill: 'vocabulary-recall',
      prompt: { content: '天气' },
      options: [],
      answer: {
        kind: 'textInput',
        acceptedAnswers: ['天気', 'てんき'],
        caseSensitive: false,
        trimWhitespace: true,
      },
      explanation: null,
      audio: null,
      metadata: { source: 'builtin' },
    });

    expect(judgeAnswer(textQuestion, ' てんき ').status).toBe(JudgementStatus.Correct);
    const incorrect = judgeAnswer(textQuestion, 'げんき');
    expect(incorrect.status).toBe(JudgementStatus.Incorrect);
    expect(incorrect.expectedAnswer).toBe('天気');
    expect(incorrect.errorReason?.code).toBe('text_mismatch');
  });
});
