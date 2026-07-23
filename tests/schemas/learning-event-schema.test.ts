import { describe, expect, it } from 'vitest';

import { EventType, LearningEventSchema } from '../../src/schemas/v1';

const validLearningEvent = {
  schemaVersion: 1,
  id: 'event-001',
  timestamp: '2026-07-24T10:00:00.000Z',
  sessionId: 'session-001',
  userId: 'user-001',
  itemId: 'item-ja-001',
  questionId: 'question-ja-001',
  eventType: EventType.AnswerIncorrect,
  payload: {
    answer: 'option-phone',
    expectedAnswer: 'option-clock',
    responseTimeMs: 3_240,
    errorCode: 'wrongOption',
  },
} as const;

describe('LearningEventSchema v1', () => {
  it('accepts a factual learning event', () => {
    expect(LearningEventSchema.safeParse(validLearningEvent).success).toBe(true);
  });

  it('rejects an invalid timestamp', () => {
    const event = {
      ...validLearningEvent,
      timestamp: 'not-a-timestamp',
    };

    expect(LearningEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects profile or mastery fields in payload', () => {
    const event = {
      ...validLearningEvent,
      payload: {
        ...validLearningEvent.payload,
        masteryLevel: 5,
      },
    };

    expect(LearningEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects an answer event without a question id', () => {
    const event = {
      ...validLearningEvent,
      questionId: null,
    };

    expect(LearningEventSchema.safeParse(event).success).toBe(false);
  });
});
