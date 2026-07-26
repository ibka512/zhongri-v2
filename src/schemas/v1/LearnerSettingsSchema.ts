import { z } from 'zod';

import { ContractVersionSchema, IdentifierSchema, LanguageSchema } from './shared';

export const LearnerSettingsFocusSchema = z.enum([
  'balanced',
  'review',
  'new-content',
  'foundations',
]);

export const LearnerSettingsDailyMinutesSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
]);

export const LearnerSettingsSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    settingsVersion: z.literal(1),
    userId: IdentifierSchema,
    language: LanguageSchema,
    dailyMinutes: LearnerSettingsDailyMinutesSchema,
    focus: LearnerSettingsFocusSchema,
    audioEnabled: z.boolean(),
    setupCompleted: z.boolean(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type LearnerSettings = z.infer<typeof LearnerSettingsSchema>;
export type LearnerSettingsFocus = z.infer<typeof LearnerSettingsFocusSchema>;
export type LearnerSettingsDailyMinutes = z.infer<typeof LearnerSettingsDailyMinutesSchema>;
