import { describe, expect, it } from 'vitest';

import { projectLearningState } from '../../src/application/profile';
import { FsrsReviewScheduler } from '../../src/infrastructure/review';
import { LearningEventSchema, type LearningEvent } from '../../src/schemas/v1';

function event(
  index: number,
  itemId: string,
  outcome: 'answerCorrect' | 'answerIncorrect',
  responseTimeMs: number,
): LearningEvent {
  return LearningEventSchema.parse({
    schemaVersion: 1,
    id: `event-${index}`,
    timestamp: `2026-07-2${index}T01:00:00.000Z`,
    sessionId: `session-${index}`,
    userId: 'learner-1',
    itemId,
    questionId: `question-${index}`,
    eventType: outcome,
    payload: {
      answer: 'answer',
      expectedAnswer: 'expected',
      responseTimeMs,
    },
  });
}

describe('projectLearningState', () => {
  it('replays evidence deterministically into profile and review projections', () => {
    const events = [
      event(1, 'word-1', 'answerIncorrect', 1_000),
      event(2, 'word-2', 'answerCorrect', 2_000),
      event(3, 'word-3', 'answerIncorrect', 3_000),
      event(4, 'word-1', 'answerCorrect', 4_000),
      event(5, 'word-2', 'answerCorrect', 5_000),
      event(6, 'word-4', 'answerCorrect', 6_000),
    ];
    const input = {
      events,
      knownItemIds: new Set(['word-1', 'word-2', 'word-3', 'word-4']),
      language: 'ja' as const,
      scheduler: new FsrsReviewScheduler(),
      userId: 'learner-1',
    };

    const projected = projectLearningState(input);
    const replayed = projectLearningState({ ...input, events: [...events].reverse() });

    expect(replayed).toEqual(projected);
    expect(projected.profile).toMatchObject({
      answeredCount: 6,
      correctCount: 4,
      incorrectCount: 2,
      accuracy: 0.6667,
      averageResponseTimeMs: 3_500,
      recentIncorrectItemIds: ['word-3'],
      recentTrend: 'improving',
    });
    expect(projected.reviewStates).toHaveLength(4);
    expect(projected.reviewStates.find((state) => state.itemId === 'word-1')?.reps).toBe(2);
  });

  it('ignores another learner and unknown content identities', () => {
    const known = event(1, 'word-1', 'answerCorrect', 1_000);
    const otherLearner = { ...event(2, 'word-1', 'answerIncorrect', 2_000), userId: 'learner-2' };
    const unknownContent = event(3, 'retired-word', 'answerIncorrect', 3_000);
    const projected = projectLearningState({
      events: [known, otherLearner, unknownContent],
      knownItemIds: new Set(['word-1']),
      language: 'ja',
      scheduler: new FsrsReviewScheduler(),
      userId: 'learner-1',
    });

    expect(projected.profile.answeredCount).toBe(1);
    expect(projected.profile.recentIncorrectItemIds).toEqual([]);
    expect(projected.reviewStates.map((state) => state.itemId)).toEqual(['word-1']);
  });
});
