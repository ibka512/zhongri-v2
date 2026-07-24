import { describe, expect, it } from 'vitest';

import {
  LearnerProfileSchema,
  LearningProjectionSchema,
  ReviewStateSchema,
} from '../../src/schemas/v1';

function createProfile() {
  return {
    schemaVersion: 1 as const,
    projectionVersion: 1 as const,
    userId: 'learner-1',
    language: 'ja' as const,
    answeredCount: 2,
    correctCount: 1,
    incorrectCount: 1,
    accuracy: 0.5,
    averageResponseTimeMs: 1_250,
    recentIncorrectItemIds: ['word-2'],
    recentTrend: 'insufficient' as const,
    projectedThrough: '2026-07-24T01:00:00.000Z',
  };
}

function createReviewState(itemId = 'word-1') {
  return {
    schemaVersion: 1 as const,
    projectionVersion: 1 as const,
    id: `learner-1:${itemId}`,
    userId: 'learner-1',
    itemId,
    algorithm: 'fsrs-6' as const,
    schedulerVersion: 'ts-fsrs@5.4.1' as const,
    due: '2026-07-25T01:00:00.000Z',
    stability: 1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 1,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: 2 as const,
    lastReview: '2026-07-24T01:00:00.000Z',
    lastEventId: 'event-1',
  };
}

describe('learning projection contracts', () => {
  it('accepts a consistent profile and one review state per item', () => {
    const projection = LearningProjectionSchema.parse({
      profile: createProfile(),
      reviewStates: [createReviewState()],
    });

    expect(projection.profile.accuracy).toBe(0.5);
    expect(projection.reviewStates[0].algorithm).toBe('fsrs-6');
  });

  it('rejects profile totals and accuracy that do not match the evidence counts', () => {
    expect(
      LearnerProfileSchema.safeParse({
        ...createProfile(),
        answeredCount: 3,
      }).success,
    ).toBe(false);
    expect(
      LearnerProfileSchema.safeParse({
        ...createProfile(),
        accuracy: 0.75,
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate review items and out-of-range scheduler state', () => {
    expect(
      LearningProjectionSchema.safeParse({
        profile: createProfile(),
        reviewStates: [createReviewState(), { ...createReviewState(), id: 'another-id' }],
      }).success,
    ).toBe(false);
    expect(
      ReviewStateSchema.safeParse({
        ...createReviewState(),
        difficulty: 11,
      }).success,
    ).toBe(false);
  });
});
