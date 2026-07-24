import { Rating, createEmptyCard, fsrs, type Card, type CardInput } from 'ts-fsrs';

import type { ReviewSchedulerPort, ScheduleReviewInput } from '../../ports/review';
import { ReviewStateSchema, type ReviewState } from '../../schemas/v1';

const scheduler = fsrs({
  enable_fuzz: false,
  enable_short_term: false,
});

function toCard(previous: ReviewState | null, reviewedAt: Date): CardInput | Card {
  if (!previous) {
    return createEmptyCard(reviewedAt);
  }

  return {
    due: previous.due,
    stability: previous.stability,
    difficulty: previous.difficulty,
    elapsed_days: previous.elapsedDays,
    scheduled_days: previous.scheduledDays,
    learning_steps: previous.learningSteps,
    reps: previous.reps,
    lapses: previous.lapses,
    state: previous.state,
    last_review: previous.lastReview,
  };
}

export class FsrsReviewScheduler implements ReviewSchedulerPort {
  schedule(input: ScheduleReviewInput): ReviewState {
    const reviewedAt = new Date(input.reviewedAt);
    const rating = input.rating === 'good' ? Rating.Good : Rating.Again;
    const result = scheduler.next(toCard(input.previous, reviewedAt), reviewedAt, rating);

    return ReviewStateSchema.parse({
      schemaVersion: 1,
      projectionVersion: 1,
      id: `${input.userId}:${input.itemId}`,
      userId: input.userId,
      itemId: input.itemId,
      algorithm: 'fsrs-6',
      schedulerVersion: 'ts-fsrs@5.4.1',
      due: result.card.due.toISOString(),
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsedDays: result.card.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      learningSteps: result.card.learning_steps,
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: result.card.state,
      lastReview: result.card.last_review?.toISOString() ?? null,
      lastEventId: input.eventId,
    });
  }
}
