import { describe, expect, it } from 'vitest';

import { StudyUseCase } from '../../src/application/study';
import { studyDemoItems } from '../../src/mock/questions';
import { EventType, JudgementStatus, LearningEventSchema } from '../../src/schemas/v1';

function createTestUseCase() {
  const times = [
    new Date('2026-07-24T10:00:00.000+09:00'),
    new Date('2026-07-24T10:00:01.250+09:00'),
    new Date('2026-07-24T10:00:02.000+09:00'),
  ];
  let id = 0;

  return new StudyUseCase(
    {
      items: studyDemoItems,
      sessionId: 'test-session',
      userId: 'test-user',
    },
    {
      createId: () => {
        id += 1;
        return `test-event-${id}`;
      },
      now: () => {
        const next = times.shift();

        if (!next) {
          throw new Error('Test clock exhausted');
        }

        return next;
      },
    },
  );
}

describe('StudyUseCase question flow', () => {
  it('records submitted and correct facts before moving to the next question', () => {
    const useCase = createTestUseCase();
    const answered = useCase.submitAnswer('neko');

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

    const next = useCase.nextQuestion();

    expect(next.status).toBe('answering');
    expect(next.currentIndex).toBe(1);
    expect(next.judgement).toBeNull();
  });

  it('records the submitted answer and incorrect reason as facts', () => {
    const useCase = createTestUseCase();
    const answered = useCase.submitAnswer('inu');

    expect(answered.judgement?.status).toBe(JudgementStatus.Incorrect);
    expect(answered.events.map((event) => event.eventType)).toEqual([
      EventType.AnswerSubmitted,
      EventType.AnswerIncorrect,
    ]);
    expect(answered.events[1]?.payload.errorCode).toBe('choice_mismatch');
    expect(answered.events[1]?.payload).not.toHaveProperty('mastery');
    expect(answered.events[1]?.payload).not.toHaveProperty('learnerProfile');
  });
});
