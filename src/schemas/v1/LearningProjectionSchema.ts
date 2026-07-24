import { z } from 'zod';

import { ContractVersionSchema, IdentifierSchema, LanguageSchema } from './shared';

export const LearnerTrendSchema = z.enum(['insufficient', 'improving', 'stable', 'declining']);

export const LearnerProfileSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    projectionVersion: z.literal(1),
    userId: IdentifierSchema,
    language: LanguageSchema,
    answeredCount: z.number().int().nonnegative(),
    correctCount: z.number().int().nonnegative(),
    incorrectCount: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1),
    averageResponseTimeMs: z.number().int().nonnegative().nullable(),
    recentIncorrectItemIds: z.array(IdentifierSchema).max(5),
    recentTrend: LearnerTrendSchema,
    projectedThrough: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((profile, context) => {
    if (profile.correctCount + profile.incorrectCount !== profile.answeredCount) {
      context.addIssue({
        code: 'custom',
        path: ['answeredCount'],
        message: 'Answered count must equal correct plus incorrect answers',
      });
    }

    const expectedAccuracy =
      profile.answeredCount === 0 ? 0 : profile.correctCount / profile.answeredCount;
    if (Math.abs(profile.accuracy - expectedAccuracy) > 0.0001) {
      context.addIssue({
        code: 'custom',
        path: ['accuracy'],
        message: 'Accuracy must match the projected answer counts',
      });
    }

    if (new Set(profile.recentIncorrectItemIds).size !== profile.recentIncorrectItemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['recentIncorrectItemIds'],
        message: 'Recent incorrect item ids must be unique',
      });
    }
  });

const ReviewCardStateSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const ReviewStateSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    projectionVersion: z.literal(1),
    id: IdentifierSchema,
    userId: IdentifierSchema,
    itemId: IdentifierSchema,
    algorithm: z.literal('fsrs-6'),
    schedulerVersion: z.literal('ts-fsrs@5.4.1'),
    due: z.string().datetime({ offset: true }),
    stability: z.number().nonnegative(),
    difficulty: z.number().min(0).max(10),
    elapsedDays: z.number().int().nonnegative(),
    scheduledDays: z.number().int().nonnegative(),
    learningSteps: z.number().int().nonnegative(),
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    state: ReviewCardStateSchema,
    lastReview: z.string().datetime({ offset: true }).nullable(),
    lastEventId: IdentifierSchema,
  })
  .strict();

export const LearningProjectionSchema = z
  .object({
    profile: LearnerProfileSchema,
    reviewStates: z.array(ReviewStateSchema),
  })
  .strict()
  .superRefine((projection, context) => {
    const reviewIds = projection.reviewStates.map((review) => review.id);
    const itemIds = projection.reviewStates.map((review) => review.itemId);

    if (new Set(reviewIds).size !== reviewIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['reviewStates'],
        message: 'Review state ids must be unique',
      });
    }

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['reviewStates'],
        message: 'A projection can contain only one review state per item',
      });
    }

    if (projection.reviewStates.some((review) => review.userId !== projection.profile.userId)) {
      context.addIssue({
        code: 'custom',
        path: ['reviewStates'],
        message: 'Review states must belong to the projected learner',
      });
    }
  });

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;
export type LearnerTrend = z.infer<typeof LearnerTrendSchema>;
export type LearningProjection = z.infer<typeof LearningProjectionSchema>;
export type ReviewState = z.infer<typeof ReviewStateSchema>;
