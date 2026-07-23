import {
  EventType,
  LearningEventSchema,
  JudgementStatus,
  type AnswerValue,
  type JudgementResult,
  type LearningEvent,
} from '../../schemas/v1';

export interface CreateAnswerLearningEventsInput {
  answer: AnswerValue;
  eventIds: readonly [submittedEventId: string, judgedEventId: string];
  itemId: string;
  judgement: JudgementResult;
  responseTimeMs: number;
  sessionId: string;
  timestamp: string;
  userId: string;
}

export function createAnswerLearningEvents(
  input: CreateAnswerLearningEventsInput,
): readonly LearningEvent[] {
  const common = {
    schemaVersion: 1 as const,
    timestamp: input.timestamp,
    sessionId: input.sessionId,
    userId: input.userId,
    itemId: input.itemId,
    questionId: input.judgement.questionId,
  };

  const submitted = LearningEventSchema.parse({
    ...common,
    id: input.eventIds[0],
    eventType: EventType.AnswerSubmitted,
    payload: {
      answer: input.answer,
      responseTimeMs: input.responseTimeMs,
    },
  });

  const judged = LearningEventSchema.parse({
    ...common,
    id: input.eventIds[1],
    eventType:
      input.judgement.status === JudgementStatus.Correct
        ? EventType.AnswerCorrect
        : EventType.AnswerIncorrect,
    payload: {
      answer: input.answer,
      expectedAnswer: input.judgement.expectedAnswer,
      responseTimeMs: input.responseTimeMs,
      ...(input.judgement.errorReason
        ? {
            errorCode: input.judgement.errorReason.code,
          }
        : {}),
    },
  });

  return [submitted, judged];
}
