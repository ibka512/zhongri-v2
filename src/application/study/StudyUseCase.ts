import { createAnswerLearningEvents, judgeAnswer } from '../../domain/study';
import type { AnswerValue } from '../../schemas/v1';
import { QuestionFlow } from './QuestionFlow';
import type { StudyItem, StudySessionSnapshot } from './StudySession';

export interface StudyUseCaseDependencies {
  createId: () => string;
  now: () => Date;
}

export interface StartStudySessionInput {
  items: readonly StudyItem[];
  sessionId: string;
  userId: string;
}

export class StudyUseCase {
  readonly #createId: () => string;
  readonly #flow: QuestionFlow;
  readonly #now: () => Date;
  #questionStartedAt: number;

  constructor(input: StartStudySessionInput, dependencies: StudyUseCaseDependencies) {
    this.#createId = dependencies.createId;
    this.#now = dependencies.now;
    this.#flow = new QuestionFlow(input.items, input.sessionId, input.userId);
    this.#questionStartedAt = this.#now().getTime();
  }

  getSnapshot(): StudySessionSnapshot {
    return this.#flow.getSnapshot();
  }

  submitAnswer(answer: AnswerValue): StudySessionSnapshot {
    const snapshot = this.#flow.getSnapshot();

    if (!snapshot.currentItem) {
      throw new Error('There is no current question to answer');
    }

    const answeredAt = this.#now();
    const responseTimeMs = Math.max(0, answeredAt.getTime() - this.#questionStartedAt);
    const judgement = judgeAnswer(snapshot.currentItem.question, answer);
    const events = createAnswerLearningEvents({
      answer,
      eventIds: [this.#createId(), this.#createId()],
      itemId: snapshot.currentItem.itemId,
      judgement,
      responseTimeMs,
      sessionId: snapshot.sessionId,
      timestamp: answeredAt.toISOString(),
      userId: snapshot.userId,
    });

    return this.#flow.recordAnswer(answer, judgement, events);
  }

  nextQuestion(): StudySessionSnapshot {
    const snapshot = this.#flow.next();

    if (snapshot.status === 'answering') {
      this.#questionStartedAt = this.#now().getTime();
    }

    return snapshot;
  }
}
