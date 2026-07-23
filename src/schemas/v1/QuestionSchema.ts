import { z } from 'zod';

import {
  ContractVersionSchema,
  IdentifierSchema,
  LanguageSchema,
  NonBlankStringSchema,
} from './shared';

export const QuestionType = {
  Choice: 'choice',
  TextInput: 'textInput',
  AudioChoice: 'audioChoice',
  Grammar: 'grammar',
  Matching: 'matching',
  Ordering: 'ordering',
  OpenAnswer: 'openAnswer',
} as const;

export const QuestionTypeSchema = z.enum([
  QuestionType.Choice,
  QuestionType.TextInput,
  QuestionType.AudioChoice,
  QuestionType.Grammar,
  QuestionType.Matching,
  QuestionType.Ordering,
  QuestionType.OpenAnswer,
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionPromptSchema = z
  .object({
    instruction: NonBlankStringSchema.max(500).optional(),
    content: NonBlankStringSchema.max(4_000),
  })
  .strict();

export type QuestionPrompt = z.infer<typeof QuestionPromptSchema>;

export const QuestionOptionSchema = z
  .object({
    id: IdentifierSchema,
    label: NonBlankStringSchema.max(1_000),
  })
  .strict();

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

const TtsAudioSchema = z
  .object({
    kind: z.literal('tts'),
    text: NonBlankStringSchema.max(4_000),
    playbackRate: z.number().min(0.5).max(2).optional(),
  })
  .strict();

const AssetAudioSchema = z
  .object({
    kind: z.literal('asset'),
    assetId: IdentifierSchema,
    transcript: NonBlankStringSchema.max(4_000).optional(),
  })
  .strict();

export const QuestionAudioSchema = z.discriminatedUnion('kind', [TtsAudioSchema, AssetAudioSchema]);

export type QuestionAudio = z.infer<typeof QuestionAudioSchema>;

export const QuestionMetadataSchema = z
  .object({
    source: z.enum(['builtin', 'manual', 'ai']),
    difficulty: z.number().int().min(1).max(5).optional(),
    tags: z.array(NonBlankStringSchema.max(64)).max(20).optional(),
    createdAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type QuestionMetadata = z.infer<typeof QuestionMetadataSchema>;

const ChoiceAnswerSchema = z
  .object({
    kind: z.literal('choice'),
    correctOptionIds: z.array(IdentifierSchema).min(1).max(10),
  })
  .strict();

const TextInputAnswerSchema = z
  .object({
    kind: z.literal('textInput'),
    acceptedAnswers: z.array(NonBlankStringSchema.max(4_000)).min(1).max(20),
    caseSensitive: z.boolean(),
    trimWhitespace: z.boolean(),
  })
  .strict();

const QuestionBaseSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    id: IdentifierSchema,
    language: LanguageSchema,
    skill: NonBlankStringSchema.max(64),
    prompt: QuestionPromptSchema,
    explanation: NonBlankStringSchema.max(4_000).nullable(),
    metadata: QuestionMetadataSchema,
  })
  .strict();

const ChoiceQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal(QuestionType.Choice),
  answer: ChoiceAnswerSchema,
  options: z.array(QuestionOptionSchema).min(2).max(12),
  audio: QuestionAudioSchema.nullable(),
});

const TextInputQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal(QuestionType.TextInput),
  answer: TextInputAnswerSchema,
  options: z.tuple([]),
  audio: QuestionAudioSchema.nullable(),
});

const AudioChoiceQuestionSchema = QuestionBaseSchema.extend({
  type: z.literal(QuestionType.AudioChoice),
  answer: ChoiceAnswerSchema,
  options: z.array(QuestionOptionSchema).min(2).max(12),
  audio: QuestionAudioSchema,
});

const MvpQuestionSchema = z.discriminatedUnion('type', [
  ChoiceQuestionSchema,
  TextInputQuestionSchema,
  AudioChoiceQuestionSchema,
]);

export const QuestionSchema = MvpQuestionSchema.superRefine((question, context) => {
  if (question.type === QuestionType.TextInput) {
    const acceptedAnswers = question.answer.acceptedAnswers;

    if (new Set(acceptedAnswers).size !== acceptedAnswers.length) {
      context.addIssue({
        code: 'custom',
        path: ['answer', 'acceptedAnswers'],
        message: 'Accepted answers must be unique',
      });
    }

    return;
  }

  const optionIds = question.options.map((option) => option.id);
  const knownOptionIds = new Set(optionIds);

  if (knownOptionIds.size !== optionIds.length) {
    context.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'Option ids must be unique',
    });
  }

  for (const correctOptionId of question.answer.correctOptionIds) {
    if (!knownOptionIds.has(correctOptionId)) {
      context.addIssue({
        code: 'custom',
        path: ['answer', 'correctOptionIds'],
        message: `Unknown correct option id: ${correctOptionId}`,
      });
    }
  }
});

export type Question = z.infer<typeof QuestionSchema>;
