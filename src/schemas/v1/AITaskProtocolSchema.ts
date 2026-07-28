import { z } from 'zod';

import { QuestionSchema, QuestionType } from './QuestionSchema';
import {
  ContractVersionSchema,
  IdentifierSchema,
  LanguageSchema,
  NonBlankStringSchema,
} from './shared';

/**
 * The first task is intentionally the only task that can cross the PWA/Gateway
 * boundary. Adding a new task requires a new protocol contract and review.
 */
export const AITaskName = {
  GenerateQuestions: 'generateQuestions',
} as const;

export const AITaskNameSchema = z.literal(AITaskName.GenerateQuestions);
export type AITaskName = z.infer<typeof AITaskNameSchema>;

export const AIPromptVersion = 'generate-questions-v1' as const;
export const AIPromptVersionSchema = z.literal(AIPromptVersion);

export const AIProtocolFailureCodeSchema = z.enum([
  'invalid-request',
  'invalid-response',
  'unavailable',
  'timeout',
  'rate-limited',
  'upstream',
]);

export type AIProtocolFailureCode = z.infer<typeof AIProtocolFailureCodeSchema>;

const SafeVersionTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/);

export const AITraceMetadataSchema = z
  .object({
    requestId: IdentifierSchema,
    schemaVersion: ContractVersionSchema,
    task: AITaskNameSchema,
    promptVersion: AIPromptVersionSchema,
    model: SafeVersionTokenSchema.nullable(),
    gatewayVersion: SafeVersionTokenSchema.nullable(),
    durationMs: z.number().int().nonnegative().max(120_000).nullable(),
  })
  .strict();

export type AITraceMetadata = z.infer<typeof AITraceMetadataSchema>;

export const AIProfileSummarySchema = z
  .object({
    language: LanguageSchema,
    answeredCount: z.number().int().nonnegative().max(100_000),
    accuracy: z.number().min(0).max(1),
    recentIncorrectItemIds: z.array(IdentifierSchema).max(5),
    recentTrend: z.enum(['insufficient', 'improving', 'stable', 'declining']),
    dailyMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    focus: z.enum(['balanced', 'review', 'new-content', 'foundations']),
  })
  .strict()
  .superRefine((profile, context) => {
    if (new Set(profile.recentIncorrectItemIds).size !== profile.recentIncorrectItemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['recentIncorrectItemIds'],
        message: 'Recent incorrect item ids must be unique',
      });
    }
  });

export type AIProfileSummary = z.infer<typeof AIProfileSummarySchema>;

export const AIQuestionContextSchema = z
  .object({
    itemId: IdentifierSchema,
    language: LanguageSchema,
    headword: NonBlankStringSchema.max(200),
    reading: NonBlankStringSchema.max(200).nullable(),
    phonetic: NonBlankStringSchema.max(200).nullable(),
    meaning: NonBlankStringSchema.max(2_000),
    partOfSpeech: NonBlankStringSchema.max(200),
    level: NonBlankStringSchema.max(64),
    difficulty: z.number().int().min(0).max(10),
    tags: z.array(NonBlankStringSchema.max(100)).max(10),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.language === 'ja' && !item.reading) {
      context.addIssue({
        code: 'custom',
        path: ['reading'],
        message: 'Japanese items require a reading',
      });
    }

    if (new Set(item.tags).size !== item.tags.length) {
      context.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'Item tags must be unique',
      });
    }
  });

export type AIQuestionContext = z.infer<typeof AIQuestionContextSchema>;

const GenerateQuestionsContentSchema = z
  .object({
    manifestId: IdentifierSchema,
    contentVersion: z.number().int().positive(),
    items: z.array(AIQuestionContextSchema).min(1).max(5),
  })
  .strict()
  .superRefine((content, context) => {
    const itemIds = content.items.map((item) => item.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Content item ids must be unique',
      });
    }
  });

export const GenerateQuestionsRequestSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    task: AITaskNameSchema,
    requestId: IdentifierSchema,
    language: LanguageSchema,
    targetCount: z.number().int().min(1).max(5),
    profile: AIProfileSummarySchema,
    content: GenerateQuestionsContentSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.profile.language !== request.language) {
      context.addIssue({
        code: 'custom',
        path: ['profile', 'language'],
        message: 'Profile language must match request language',
      });
    }

    if (request.content.items.some((item) => item.language !== request.language)) {
      context.addIssue({
        code: 'custom',
        path: ['content', 'items'],
        message: 'All content items must match request language',
      });
    }

    if (request.targetCount > request.content.items.length) {
      context.addIssue({
        code: 'custom',
        path: ['targetCount'],
        message: 'Target count cannot exceed content item count',
      });
    }
  });

export type GenerateQuestionsRequest = z.infer<typeof GenerateQuestionsRequestSchema>;

export const AIQuestionCandidateSchema = z
  .object({
    itemId: IdentifierSchema,
    question: QuestionSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.question.metadata.source !== 'ai') {
      context.addIssue({
        code: 'custom',
        path: ['question', 'metadata', 'source'],
        message: 'Generated questions must be marked as AI sourced',
      });
    }

    if (
      candidate.question.type !== QuestionType.Choice &&
      candidate.question.type !== QuestionType.TextInput
    ) {
      context.addIssue({
        code: 'custom',
        path: ['question', 'type'],
        message: 'Only choice and text input questions are allowed for this task',
      });
    }
  });

export type AIQuestionCandidate = z.infer<typeof AIQuestionCandidateSchema>;

export const GenerateQuestionsResultSchema = z
  .object({
    questions: z.array(AIQuestionCandidateSchema).min(1).max(5),
  })
  .strict()
  .superRefine((result, context) => {
    const questionIds = result.questions.map((candidate) => candidate.question.id);
    const itemIds = result.questions.map((candidate) => candidate.itemId);

    if (new Set(questionIds).size !== questionIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Generated question ids must be unique',
      });
    }

    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'Generated item ids must be unique',
      });
    }
  });

export type GenerateQuestionsResult = z.infer<typeof GenerateQuestionsResultSchema>;

const AIGatewayResponseBaseSchema = z.object({
  schemaVersion: ContractVersionSchema,
  task: AITaskNameSchema,
  requestId: IdentifierSchema,
  trace: AITraceMetadataSchema,
});

export const AIGatewaySuccessSchema = AIGatewayResponseBaseSchema.extend({
  status: z.literal('success'),
  result: GenerateQuestionsResultSchema,
}).strict();

export type AIGatewaySuccess = z.infer<typeof AIGatewaySuccessSchema>;

export const AIGatewayFailureSchema = AIGatewayResponseBaseSchema.extend({
  status: z.literal('failure'),
  error: z
    .object({
      code: AIProtocolFailureCodeSchema,
      retryable: z.boolean(),
    })
    .strict(),
}).strict();

export type AIGatewayFailure = z.infer<typeof AIGatewayFailureSchema>;

export const AIGatewayResponseSchema = z.discriminatedUnion('status', [
  AIGatewaySuccessSchema,
  AIGatewayFailureSchema,
]);

export type AIGatewayResponse = z.infer<typeof AIGatewayResponseSchema>;

export const AIProtocolRequestSchema = GenerateQuestionsRequestSchema;
export const AIProtocolResultSchema = AIGatewaySuccessSchema;
export const AIProtocolFailureSchema = AIGatewayFailureSchema;
export const AIRequestSchema = GenerateQuestionsRequestSchema;
export const AIResultSchema = AIGatewaySuccessSchema;
export const AIFailureSchema = AIGatewayFailureSchema;
export const AIResponseSchema = AIGatewayResponseSchema;

export type AIRequest = GenerateQuestionsRequest;
export type AIResult = AIGatewaySuccess;
export type AIFailure = AIGatewayFailure;
export type AIResponse = AIGatewayResponse;

/**
 * Validate response/request relationships that cannot be expressed in the
 * standalone response schema without duplicating request data.
 */
export function parseGenerateQuestionsResponse(
  input: unknown,
  request: GenerateQuestionsRequest,
): AIGatewayResponse {
  const response = AIGatewayResponseSchema.parse(input);

  if (
    response.schemaVersion !== request.schemaVersion ||
    response.task !== request.task ||
    response.requestId !== request.requestId ||
    response.trace.requestId !== request.requestId ||
    response.trace.task !== request.task ||
    response.trace.schemaVersion !== request.schemaVersion
  ) {
    throw new Error('AI response correlation metadata does not match request');
  }

  if (response.status === 'failure') {
    return response;
  }

  if (response.result.questions.length > request.targetCount) {
    throw new Error('AI response returned more questions than requested');
  }

  const knownItemIds = new Set(request.content.items.map((item) => item.itemId));
  for (const candidate of response.result.questions) {
    if (!knownItemIds.has(candidate.itemId)) {
      throw new Error('AI response referenced an unknown content item');
    }

    if (candidate.question.language !== request.language) {
      throw new Error('AI response language does not match request');
    }
  }

  return response;
}
