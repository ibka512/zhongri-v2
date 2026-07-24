import { z } from 'zod';

import { JudgementResultSchema } from './JudgementSchema';
import { AnswerValueSchema, ContractVersionSchema, IdentifierSchema } from './shared';

export const StudySessionCheckpointSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    sessionId: IdentifierSchema,
    userId: IdentifierSchema,
    currentIndex: z.number().int().nonnegative(),
    questionId: IdentifierSchema,
    status: z.literal('feedback'),
    selectedAnswer: AnswerValueSchema,
    judgement: JudgementResultSchema,
    eventIds: z.tuple([IdentifierSchema, IdentifierSchema]),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type StudySessionCheckpoint = z.infer<typeof StudySessionCheckpointSchema>;
