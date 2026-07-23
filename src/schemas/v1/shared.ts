import { z } from 'zod';

export const ContractVersionSchema = z.literal(1);

export const IdentifierSchema = z.string().trim().min(1).max(128);

export const NonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, 'String must contain non-whitespace characters');

export const LanguageSchema = z.enum(['ja', 'en']);

export type Language = z.infer<typeof LanguageSchema>;

const AnswerTextSchema = NonBlankStringSchema.max(4_000);

export const AnswerValueSchema = z.union([
  AnswerTextSchema,
  z.array(AnswerTextSchema).min(1).max(20),
]);

export type AnswerValue = z.infer<typeof AnswerValueSchema>;
