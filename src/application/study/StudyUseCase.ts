import { createAnswerLearningEvents, judgeAnswer } from '../../domain/study';
import {
  createAnswerSubmissionFingerprint,
  type ClockPort,
  type IdGeneratorPort,
  type LearningTransactionPort,
} from '../../ports';
import { StudySessionCheckpointSchema } from '../../schemas/v1';
import type { AnswerValue } from '../../schemas/v1';
import { QuestionFlow } from './QuestionFlow';
import type { StudyItem, StudySessionSnapshot } from './StudySession';

export interface StudyUseCaseDependencies {
  clock: ClockPort;
  idGenerator: IdGeneratorPort;
  transaction: LearningTransactionPort;
}

export interface StartStudySessionInput {
  items: readonly StudyItem[];
  sessionId: string;
  userId: string;
}

export class StudyUseCase {
  readonly #clock: ClockPort;
  readonly #flow: QuestionFlow;
  readonly #idGenerator: IdGeneratorPort;
  readonly #transaction: LearningTransactionPort;
  #isSubmitting = false;
  #questionStartedAt: number;

  constructor(input: StartStudySessionInput, dependencies: StudyUseCaseDependencies) {
    this.#clock = dependencies.clock;
    this.#idGenerator = dependencies.idGenerator;
    this.#transaction = dependencies.transaction;
    this.#flow = new QuestionFlow(input.items, input.sessionId, input.userId);
    this.#questionStartedAt = this.#clock.now().getTime();
  }

  getSnapshot(): StudySessionSnapshot {
    return this.#flow.getSnapshot();
  }

  async submitAnswer(answer: AnswerValue, idempotencyKey: string): Promise<StudySessionSnapshot> {
    if (this.#isSubmitting) {
      throw new Error('An answer submission is already in progress');
    }

    this.#isSubmitting = true;

    try {
      return await this.#commitAnswer(answer, idempotencyKey);
    } finally {
      this.#isSubmitting = false;
    }
  }

  async #commitAnswer(answer: AnswerValue, idempotencyKey: string): Promise<StudySessionSnapshot> {
    const snapshot = this.#flow.getSnapshot();

    if (!snapshot.currentItem) {
      throw new Error('There is no current question to answer');
    }

    const answeredAt = this.#clock.now();
    const responseTimeMs = Math.max(0, answeredAt.getTime() - this.#questionStartedAt);
    const judgement = judgeAnswer(snapshot.currentItem.question, answer);
    const eventIds = [this.#idGenerator.nextId(), this.#idGenerator.nextId()] as const;
    const events = createAnswerLearningEvents({
      answer,
      eventIds,
      itemId: snapshot.currentItem.itemId,
      judgement,
      responseTimeMs,
      sessionId: snapshot.sessionId,
      timestamp: answeredAt.toISOString(),
      userId: snapshot.userId,
    });
    const checkpoint = StudySessionCheckpointSchema.parse({
      schemaVersion: 1,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      currentIndex: snapshot.currentIndex,
      questionId: snapshot.currentItem.question.id,
      status: 'feedback',
      selectedAnswer: answer,
      judgement,
      eventIds,
      updatedAt: answeredAt.toISOString(),
    });
    const committed = await this.#transaction.commitAnswer({
      idempotencyKey,
      requestFingerprint: createAnswerSubmissionFingerprint({
        sessionId: snapshot.sessionId,
        questionId: snapshot.currentItem.question.id,
        answer,
      }),
      events,
      checkpoint,
    });

    return this.#flow.recordAnswer(
      committed.checkpoint.selectedAnswer,
      committed.checkpoint.judgement,
      committed.events,
    );
  }

  nextQuestion(): StudySessionSnapshot {
    const snapshot = this.#flow.next();

    if (snapshot.status === 'answering') {
      this.#questionStartedAt = this.#clock.now().getTime();
    }

    return snapshot;
  }
}
