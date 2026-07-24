import { z } from 'zod';

import { JudgementResultSchema } from './JudgementSchema';
import { AnswerValueSchema, ContractVersionSchema, IdentifierSchema } from './shared';

export const StudySessionStatusSchema = z.enum(['answering', 'feedback', 'completed']);

export const StudySessionItemReferenceSchema = z
  .object({
    itemId: IdentifierSchema,
    questionId: IdentifierSchema,
  })
  .strict();

export const StudySessionStateSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    sessionId: IdentifierSchema,
    userId: IdentifierSchema,
    itemReferences: z.array(StudySessionItemReferenceSchema).min(1).max(10_000),
    currentIndex: z.number().int().nonnegative(),
    status: StudySessionStatusSchema,
    selectedAnswer: AnswerValueSchema.nullable(),
    judgement: JudgementResultSchema.nullable(),
    eventIds: z.array(IdentifierSchema).max(20_000),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.currentIndex >= state.itemReferences.length) {
      context.addIssue({
        code: 'custom',
        path: ['currentIndex'],
        message: 'Current index must reference an item in the session',
      });
      return;
    }

    if (new Set(state.eventIds).size !== state.eventIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['eventIds'],
        message: 'Session event ids must be unique',
      });
    }

    if (state.status === 'feedback') {
      if (state.selectedAnswer === null || state.judgement === null) {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'Feedback state requires an answer and judgement',
        });
        return;
      }

      const currentQuestionId = state.itemReferences[state.currentIndex]?.questionId;

      if (state.judgement.questionId !== currentQuestionId) {
        context.addIssue({
          code: 'custom',
          path: ['judgement', 'questionId'],
          message: 'Judgement must belong to the current question',
        });
      }

      return;
    }

    if (state.selectedAnswer !== null || state.judgement !== null) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Answering and completed states cannot retain feedback data',
      });
    }

    if (state.status === 'completed' && state.currentIndex !== state.itemReferences.length - 1) {
      context.addIssue({
        code: 'custom',
        path: ['currentIndex'],
        message: 'Completed state must point to the final session item',
      });
    }
  });

export type StudySessionState = z.infer<typeof StudySessionStateSchema>;
export type StudySessionStatusValue = z.infer<typeof StudySessionStatusSchema>;
