import { z } from 'zod';

import {
  AnswerValueSchema,
  ContractVersionSchema,
  IdentifierSchema,
  NonBlankStringSchema,
} from './shared';

export const EventType = {
  AnswerSubmitted: 'answerSubmitted',
  AnswerCorrect: 'answerCorrect',
  AnswerIncorrect: 'answerIncorrect',
  Forgotten: 'forgotten',
  Uncertain: 'uncertain',
  Recognized: 'recognized',
  HintUsed: 'hintUsed',
  AudioReplayed: 'audioReplayed',
  Skipped: 'skipped',
  SessionExited: 'sessionExited',
} as const;

export const EventTypeSchema = z.enum([
  EventType.AnswerSubmitted,
  EventType.AnswerCorrect,
  EventType.AnswerIncorrect,
  EventType.Forgotten,
  EventType.Uncertain,
  EventType.Recognized,
  EventType.HintUsed,
  EventType.AudioReplayed,
  EventType.Skipped,
  EventType.SessionExited,
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const LearningEventPayloadSchema = z
  .object({
    answer: AnswerValueSchema.optional(),
    expectedAnswer: AnswerValueSchema.optional(),
    responseTimeMs: z.number().int().nonnegative().optional(),
    errorCode: NonBlankStringSchema.max(128).optional(),
    hintKind: z.enum(['definition', 'example', 'firstCharacter', 'other']).optional(),
    replayCount: z.number().int().positive().optional(),
    reason: NonBlankStringSchema.max(500).optional(),
  })
  .strict();

export type LearningEventPayload = z.infer<typeof LearningEventPayloadSchema>;

const AnswerEventTypes = new Set<EventType>([
  EventType.AnswerSubmitted,
  EventType.AnswerCorrect,
  EventType.AnswerIncorrect,
]);

const QuestionEventTypes = new Set<EventType>([
  ...AnswerEventTypes,
  EventType.HintUsed,
  EventType.AudioReplayed,
  EventType.Skipped,
]);

export const LearningEventSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    id: IdentifierSchema,
    timestamp: z.string().datetime({ offset: true }),
    sessionId: IdentifierSchema,
    userId: IdentifierSchema,
    itemId: IdentifierSchema.nullable(),
    questionId: IdentifierSchema.nullable(),
    eventType: EventTypeSchema,
    payload: LearningEventPayloadSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.eventType !== EventType.SessionExited && event.itemId === null) {
      context.addIssue({
        code: 'custom',
        path: ['itemId'],
        message: 'A learning-content event requires an item id',
      });
    }

    if (QuestionEventTypes.has(event.eventType) && event.questionId === null) {
      context.addIssue({
        code: 'custom',
        path: ['questionId'],
        message: 'A question event requires a question id',
      });
    }

    if (AnswerEventTypes.has(event.eventType)) {
      if (event.payload.answer === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['payload', 'answer'],
          message: 'An answer event requires the user answer',
        });
      }

      if (event.payload.responseTimeMs === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['payload', 'responseTimeMs'],
          message: 'An answer event requires response time',
        });
      }
    }

    if (
      (event.eventType === EventType.AnswerCorrect ||
        event.eventType === EventType.AnswerIncorrect) &&
      event.payload.expectedAnswer === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'expectedAnswer'],
        message: 'A judged answer event requires the expected answer',
      });
    }

    if (event.eventType === EventType.HintUsed && event.payload.hintKind === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'hintKind'],
        message: 'A hint event requires the hint kind',
      });
    }

    if (event.eventType === EventType.AudioReplayed && event.payload.replayCount === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['payload', 'replayCount'],
        message: 'An audio replay event requires the replay count',
      });
    }
  });

export type LearningEvent = z.infer<typeof LearningEventSchema>;
