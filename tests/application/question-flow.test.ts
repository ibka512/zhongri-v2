import { describe, expect, it } from 'vitest';

import {
  SessionRestoreError,
  StudyUseCase,
  type StartStudySessionInput,
} from '../../src/application/study';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import { studyDemoItems } from '../../src/mock/questions';
import {
  EventType,
  JudgementStatus,
  LearningEventSchema,
  StudySessionStateSchema,
} from '../../src/schemas/v1';

const sessionInput: StartStudySessionInput = {
  items: studyDemoItems,
  sessionId: 'test-session',
  userId: 'test-user',
};

function createTestUseCase() {
  const times = [
    new Date('2026-07-24T10:00:00.000+09:00'),
    new Date('2026-07-24T10:00:01.250+09:00'),
    new Date('2026-07-24T10:00:02.000+09:00'),
  ];
  let id = 0;
  const persistence = new InMemoryStudyPersistence();

  return {
    persistence,
    useCase: new StudyUseCase(sessionInput, {
      clock: {
        now: () => {
          const next = times.shift();

          if (!next) {
            throw new Error('Test clock exhausted');
          }

          return next;
        },
      },
      idGenerator: {
        nextId: () => {
          id += 1;
          return `test-event-${id}`;
        },
      },
      persistence,
    }),
  };
}

function createRecoverableHarness() {
  const persistence = new InMemoryStudyPersistence();
  let id = 0;
  let timestamp = new Date('2026-07-24T01:00:00.000Z').getTime();
  const dependencies = {
    clock: {
      now: () => {
        const now = new Date(timestamp);
        timestamp += 1_000;
        return now;
      },
    },
    idGenerator: {
      nextId: () => {
        id += 1;
        return `recoverable-event-${id}`;
      },
    },
    persistence,
  };

  return {
    createUseCase: () => StudyUseCase.startOrResume(sessionInput, dependencies),
    persistence,
    restartUseCase: () => StudyUseCase.restart(sessionInput, dependencies),
  };
}

describe('StudyUseCase question flow', () => {
  it('records submitted and correct facts before moving to the next question', async () => {
    const { persistence, useCase } = createTestUseCase();
    const answered = await useCase.submitAnswer('neko', 'test-session:question-1');

    expect(answered.status).toBe('feedback');
    expect(answered.judgement?.status).toBe(JudgementStatus.Correct);
    expect(answered.events.map((event) => event.eventType)).toEqual([
      EventType.AnswerSubmitted,
      EventType.AnswerCorrect,
    ]);
    expect(answered.events.every((event) => LearningEventSchema.safeParse(event).success)).toBe(
      true,
    );
    expect(answered.events[0]?.payload.responseTimeMs).toBe(1_250);
    expect(await persistence.findBySessionId('test-session')).toHaveLength(2);
    expect(await persistence.findCheckpoint('test-session')).toMatchObject({
      questionId: studyDemoItems[0]?.question.id,
      status: 'feedback',
    });

    const next = await useCase.nextQuestion();

    expect(next.status).toBe('answering');
    expect(next.currentIndex).toBe(1);
    expect(next.judgement).toBeNull();
  });

  it('records the submitted answer and incorrect reason as facts', async () => {
    const { useCase } = createTestUseCase();
    const answered = await useCase.submitAnswer('inu', 'test-session:question-1');

    expect(answered.judgement?.status).toBe(JudgementStatus.Incorrect);
    expect(answered.events.map((event) => event.eventType)).toEqual([
      EventType.AnswerSubmitted,
      EventType.AnswerIncorrect,
    ]);
    expect(answered.events[1]?.payload.errorCode).toBe('choice_mismatch');
    expect(answered.events[1]?.payload).not.toHaveProperty('mastery');
    expect(answered.events[1]?.payload).not.toHaveProperty('learnerProfile');
  });

  it('keeps the question answerable when the transaction fails', async () => {
    const { persistence, useCase } = createTestUseCase();
    persistence.failNextCommit();

    await expect(useCase.submitAnswer('neko', 'test-session:question-1')).rejects.toThrow(
      'Injected transaction failure',
    );

    expect(useCase.getSnapshot()).toMatchObject({
      status: 'answering',
      selectedAnswer: null,
      events: [],
    });
    expect(await persistence.findBySessionId('test-session')).toEqual([]);
    expect(await persistence.findCheckpoint('test-session')).toBeNull();

    const retried = await useCase.submitAnswer('neko', 'test-session:question-1');
    expect(retried.status).toBe('feedback');
    expect(await persistence.findBySessionId('test-session')).toHaveLength(2);
  });

  it('restores feedback and advances from the durable session state', async () => {
    const { createUseCase, persistence } = createRecoverableHarness();
    const firstUseCase = await createUseCase();

    await firstUseCase.submitAnswer('neko', 'test-session:question-1');

    const restoredFeedback = await createUseCase();
    expect(restoredFeedback.getSnapshot()).toMatchObject({
      currentIndex: 0,
      status: 'feedback',
      selectedAnswer: 'neko',
    });
    expect(restoredFeedback.getSnapshot().events).toHaveLength(2);

    await restoredFeedback.nextQuestion();

    const restoredNextQuestion = await createUseCase();
    expect(restoredNextQuestion.getSnapshot()).toMatchObject({
      currentIndex: 1,
      status: 'answering',
      selectedAnswer: null,
    });
    expect(await persistence.findSessionState('test-session')).toMatchObject({
      currentIndex: 1,
      status: 'answering',
      eventIds: ['recoverable-event-1', 'recoverable-event-2'],
    });
  });

  it('restores a completed session with its full event history', async () => {
    const { createUseCase } = createRecoverableHarness();
    const useCase = await createUseCase();

    await useCase.submitAnswer('neko', 'test-session:question-1');
    await useCase.nextQuestion();
    await useCase.submitAnswer('hi', 'test-session:question-2');
    await useCase.nextQuestion();
    await useCase.submitAnswer('toshokan', 'test-session:question-3');
    await useCase.nextQuestion();

    const restored = await createUseCase();
    expect(restored.getSnapshot()).toMatchObject({
      currentIndex: 2,
      currentItem: null,
      status: 'completed',
    });
    expect(restored.getSnapshot().events).toHaveLength(6);
  });

  it('restarts an answered session from the first question with no event history', async () => {
    const { createUseCase, persistence, restartUseCase } = createRecoverableHarness();
    const useCase = await createUseCase();
    await useCase.submitAnswer('neko', 'test-session:question-1');

    const restarted = await restartUseCase();

    expect(restarted.getSnapshot()).toMatchObject({
      currentIndex: 0,
      status: 'answering',
      selectedAnswer: null,
      events: [],
    });
    expect(await persistence.findBySessionId('test-session')).toEqual([]);
    expect(await persistence.findCheckpoint('test-session')).toBeNull();
    expect(await persistence.findSessionState('test-session')).toMatchObject({
      currentIndex: 0,
      status: 'answering',
      eventIds: [],
    });
  });

  it('does not advance the in-memory flow when saving progress fails', async () => {
    const { createUseCase, persistence } = createRecoverableHarness();
    const useCase = await createUseCase();
    await useCase.submitAnswer('neko', 'test-session:question-1');
    persistence.failNextCommit();

    await expect(useCase.nextQuestion()).rejects.toThrow('Injected transaction failure');
    expect(useCase.getSnapshot()).toMatchObject({
      currentIndex: 0,
      status: 'feedback',
      selectedAnswer: 'neko',
    });

    const retried = await useCase.nextQuestion();
    expect(retried).toMatchObject({
      currentIndex: 1,
      status: 'answering',
    });
  });

  it('rejects a stored session when its question set no longer matches', async () => {
    const { createUseCase, persistence } = createRecoverableHarness();
    await createUseCase();
    const existing = await persistence.findSessionState('test-session');

    expect(existing).not.toBeNull();
    await persistence.saveSessionState(
      StudySessionStateSchema.parse({
        ...existing,
        itemReferences: existing?.itemReferences.map((reference, index) =>
          index === 0 ? { ...reference, questionId: 'different-question' } : reference,
        ),
      }),
    );

    await expect(createUseCase()).rejects.toBeInstanceOf(SessionRestoreError);
  });
});
