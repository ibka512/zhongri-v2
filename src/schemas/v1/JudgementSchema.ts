import { z } from 'zod';

import {
  AnswerValueSchema,
  ContractVersionSchema,
  IdentifierSchema,
  NonBlankStringSchema,
} from './shared';

export const JudgementStatus = {
  Correct: 'correct',
  Incorrect: 'incorrect',
  Partial: 'partial',
} as const;

export const JudgementStatusSchema = z.enum([
  JudgementStatus.Correct,
  JudgementStatus.Incorrect,
  JudgementStatus.Partial,
]);

export type JudgementStatus = z.infer<typeof JudgementStatusSchema>;

export const JudgementErrorReasonSchema = z
  .object({
    code: NonBlankStringSchema.max(128),
    message: NonBlankStringSchema.max(1_000),
  })
  .strict();

export type JudgementErrorReason = z.infer<typeof JudgementErrorReasonSchema>;

export const JudgementResultSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    questionId: IdentifierSchema,
    status: JudgementStatusSchema,
    userAnswer: AnswerValueSchema,
    expectedAnswer: AnswerValueSchema,
    errorReason: JudgementErrorReasonSchema.nullable(),
    feedbackText: NonBlankStringSchema.max(2_000),
    requiresAiExplanation: z.boolean(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.status === JudgementStatus.Correct && result.errorReason !== null) {
      context.addIssue({
        code: 'custom',
        path: ['errorReason'],
        message: 'A correct result cannot contain an error reason',
      });
    }

    if (result.status !== JudgementStatus.Correct && result.errorReason === null) {
      context.addIssue({
        code: 'custom',
        path: ['errorReason'],
        message: 'An incorrect or partial result requires an error reason',
      });
    }
  });

export type JudgementResult = z.infer<typeof JudgementResultSchema>;
