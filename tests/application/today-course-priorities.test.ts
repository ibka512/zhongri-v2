import { describe, expect, it } from 'vitest';

import {
  createTodayCoursePriorities,
  mergeCrossLanguageReviewStates,
} from '../../src/app/todayCourse';
import { LearningProjectionSchema } from '../../src/schemas/v1';

function review(itemId: string, due: string) {
  return {
    schemaVersion: 1 as const,
    projectionVersion: 1 as const,
    id: `learner-1:${itemId}`,
    userId: 'learner-1',
    itemId,
    algorithm: 'fsrs-6' as const,
    schedulerVersion: 'ts-fsrs@5.4.1' as const,
    due,
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 2 as const,
    lastReview: '2026-07-23T01:00:00.000Z',
    lastEventId: `event-${itemId}`,
  };
}

describe('createTodayCoursePriorities', () => {
  it('orders due reviews first and de-duplicates recent incorrect words', () => {
    const projection = LearningProjectionSchema.parse({
      profile: {
        schemaVersion: 1,
        projectionVersion: 1,
        userId: 'learner-1',
        language: 'ja',
        answeredCount: 2,
        correctCount: 0,
        incorrectCount: 2,
        accuracy: 0,
        averageResponseTimeMs: 1_000,
        recentIncorrectItemIds: ['word-3', 'word-1'],
        recentTrend: 'insufficient',
        projectedThrough: '2026-07-23T01:00:00.000Z',
      },
      reviewStates: [
        review('word-1', '2026-07-24T10:00:00.000Z'),
        review('word-2', '2026-07-23T10:00:00.000Z'),
        review('word-3', '2026-07-25T10:00:00.000Z'),
      ],
    });

    expect(createTodayCoursePriorities(projection, new Date('2026-07-25T00:00:00.000Z'))).toEqual([
      { wordId: 'word-2', reason: 'due-review' },
      { wordId: 'word-1', reason: 'due-review' },
      { wordId: 'word-3', reason: 'recent-incorrect' },
    ]);
  });
});

describe('mergeCrossLanguageReviewStates', () => {
  it('replaces the active language and preserves another language', () => {
    const projection = LearningProjectionSchema.parse({
      profile: {
        schemaVersion: 1,
        projectionVersion: 1,
        userId: 'learner-1',
        language: 'en',
        answeredCount: 1,
        correctCount: 1,
        incorrectCount: 0,
        accuracy: 1,
        averageResponseTimeMs: 1_000,
        recentIncorrectItemIds: [],
        recentTrend: 'insufficient',
        projectedThrough: '2026-07-24T01:00:00.000Z',
      },
      reviewStates: [review('en-current', '2026-07-25T10:00:00.000Z')],
    });

    const merged = mergeCrossLanguageReviewStates(
      projection,
      [
        review('en-stale', '2026-07-23T10:00:00.000Z'),
        review('ja-word', '2026-07-24T10:00:00.000Z'),
      ],
      new Set(['en-current', 'en-stale']),
    );

    expect(merged.reviewStates.map((state) => state.itemId)).toEqual(['en-current', 'ja-word']);
  });
});
