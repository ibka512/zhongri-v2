import { describe, expect, it } from 'vitest';

import { TodayPlanSchema } from '../../src/schemas/v1';

const validPlan = {
  schemaVersion: 1,
  id: 'today-ja-2026-07-24-test',
  localDate: '2026-07-24',
  language: 'ja',
  sourceManifestId: 'test-manifest',
  sourceContentVersion: 1,
  estimatedMinutes: 5,
  title: '今日 N5 日语',
  items: [
    {
      itemId: 'word-1',
      wordId: 'word-1',
      questionId: 'question-1',
      questionType: 'choice',
    },
    {
      itemId: 'word-2',
      wordId: 'word-2',
      questionId: 'question-2',
      questionType: 'textInput',
    },
    {
      itemId: 'word-3',
      wordId: 'word-3',
      questionId: 'question-3',
      questionType: 'choice',
    },
    {
      itemId: 'word-4',
      wordId: 'word-4',
      questionId: 'question-4',
      questionType: 'textInput',
    },
    {
      itemId: 'word-5',
      wordId: 'word-5',
      questionId: 'question-5',
      questionType: 'choice',
    },
  ],
} as const;

describe('TodayPlanSchema', () => {
  it('accepts the fixed five-question daily slice', () => {
    expect(TodayPlanSchema.parse(validPlan)).toEqual(validPlan);
  });

  it('rejects invalid dates and duplicate canonical words', () => {
    expect(
      TodayPlanSchema.safeParse({
        ...validPlan,
        localDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(
      TodayPlanSchema.safeParse({
        ...validPlan,
        items: validPlan.items.map((item, index) =>
          index === 4 ? { ...item, wordId: 'word-1' } : item,
        ),
      }).success,
    ).toBe(false);
  });

  it('requires exactly three choice and two text input questions', () => {
    expect(
      TodayPlanSchema.safeParse({
        ...validPlan,
        items: validPlan.items.map((item) => ({ ...item, questionType: 'choice' })),
      }).success,
    ).toBe(false);
  });
});
