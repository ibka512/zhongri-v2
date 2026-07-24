import type { ReviewState } from '../../schemas/v1';

export type ReviewRating = 'again' | 'good';

export interface ScheduleReviewInput {
  eventId: string;
  itemId: string;
  previous: ReviewState | null;
  rating: ReviewRating;
  reviewedAt: string;
  userId: string;
}

export interface ReviewSchedulerPort {
  schedule: (input: ScheduleReviewInput) => ReviewState;
}
