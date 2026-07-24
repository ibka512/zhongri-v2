import { z } from 'zod';

import {
  ContractVersionSchema,
  IdentifierSchema,
  LanguageSchema,
  NonBlankStringSchema,
} from './shared';

const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Date must be a valid calendar date');

export const TodayPlanItemSchema = z
  .object({
    itemId: IdentifierSchema,
    wordId: IdentifierSchema,
    questionId: IdentifierSchema,
    questionType: z.enum(['choice', 'textInput']),
  })
  .strict();

export const TodayPlanSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    id: IdentifierSchema,
    localDate: LocalDateSchema,
    language: LanguageSchema,
    sourceManifestId: IdentifierSchema,
    sourceContentVersion: z.number().int().positive(),
    estimatedMinutes: z.number().int().positive().max(60),
    items: z.array(TodayPlanItemSchema).length(5),
    title: NonBlankStringSchema.max(100),
  })
  .strict()
  .superRefine((plan, context) => {
    const wordIds = plan.items.map((item) => item.wordId);
    const itemIds = plan.items.map((item) => item.itemId);
    const questionIds = plan.items.map((item) => item.questionId);

    for (const [path, values] of [
      ['wordId', wordIds],
      ['itemId', itemIds],
      ['questionId', questionIds],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          path: ['items', path],
          message: `Today plan ${path}s must be unique`,
        });
      }
    }

    const choiceCount = plan.items.filter((item) => item.questionType === 'choice').length;
    const textInputCount = plan.items.filter((item) => item.questionType === 'textInput').length;

    if (choiceCount !== 3 || textInputCount !== 2) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Today plan requires exactly three choice and two text input questions',
      });
    }
  });

export type TodayPlan = z.infer<typeof TodayPlanSchema>;
export type TodayPlanItem = z.infer<typeof TodayPlanItemSchema>;
