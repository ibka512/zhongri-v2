import { describe, expect, it } from 'vitest';

import { StudyUseCase } from '../../src/application/study';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import { studyDemoItems } from '../../src/mock/questions';
import { EventType, JudgementStatus, LearningEventSchema } from '../../src/schemas/v1';

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
    useCase: new StudyUseCase(
      {
        items: studyDemoItems,
        sessionId: 'test-session',
        userId: 'test-user',
      },
      {
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
        transaction: persistence,
      },
    ),
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

    const next = useCase.nextQuestion();

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
});
