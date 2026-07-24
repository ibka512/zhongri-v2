import { createAnswerLearningEvents, judgeAnswer } from '../../domain/study';
import {
  createAnswerSubmissionFingerprint,
  type ClockPort,
  type IdGeneratorPort,
  type StudyPersistencePort,
} from '../../ports';
import {
  StudySessionCheckpointSchema,
  StudySessionStateSchema,
  type AnswerValue,
  type LearningEvent,
  type StudySessionState,
} from '../../schemas/v1';
import { QuestionFlow } from './QuestionFlow';
import type { StudyItem, StudySessionSnapshot, StudySessionStatus } from './StudySession';

export interface StudyUseCaseDependencies {
  clock: ClockPort;
  idGenerator: IdGeneratorPort;
  persistence: StudyPersistencePort;
}

export interface StartStudySessionInput {
  items: readonly StudyItem[];
  sessionId: string;
  userId: string;
}

interface RestoredSession {
  state: StudySessionState;
  events: readonly LearningEvent[];
}

export class SessionRestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRestoreError';
  }
}

function createItemReferences(items: readonly StudyItem[]) {
  return items.map((item) => ({
    itemId: item.itemId,
    questionId: item.question.id,
  }));
}

function orderAndValidateRestoredEvents(
  state: StudySessionState,
  events: readonly LearningEvent[],
): readonly LearningEvent[] {
  if (state.eventIds.length !== events.length) {
    throw new SessionRestoreError('Stored session event references do not match persisted events');
  }

  const eventsById = new Map(events.map((event) => [event.id, event]));
  const ordered = state.eventIds.map((eventId) => {
    const event = eventsById.get(eventId);

    if (!event) {
      throw new SessionRestoreError(`Stored session references missing event "${eventId}"`);
    }

    return event;
  });

  if (ordered.some((event) => event.sessionId !== state.sessionId)) {
    throw new SessionRestoreError('Stored session contains events from another session');
  }

  return ordered;
}

export class StudyUseCase {
  readonly #clock: ClockPort;
  readonly #flow: QuestionFlow;
  readonly #idGenerator: IdGeneratorPort;
  readonly #items: readonly StudyItem[];
  readonly #persistence: StudyPersistencePort;
  #isSubmitting = false;
  #questionStartedAt: number;

  constructor(
    input: StartStudySessionInput,
    dependencies: StudyUseCaseDependencies,
    restored?: RestoredSession,
  ) {
    this.#clock = dependencies.clock;
    this.#idGenerator = dependencies.idGenerator;
    this.#items = [...input.items];
    this.#persistence = dependencies.persistence;

    if (restored) {
      this.#validateRestoredState(input, restored.state);
      const events = orderAndValidateRestoredEvents(restored.state, restored.events);
      this.#flow = new QuestionFlow(input.items, input.sessionId, input.userId, {
        currentIndex: restored.state.currentIndex,
        events,
        judgement: restored.state.judgement,
        selectedAnswer: restored.state.selectedAnswer,
        status: restored.state.status,
      });
    } else {
      this.#flow = new QuestionFlow(input.items, input.sessionId, input.userId);
    }

    this.#questionStartedAt = this.#clock.now().getTime();
  }

  static async startOrResume(
    input: StartStudySessionInput,
    dependencies: StudyUseCaseDependencies,
  ): Promise<StudyUseCase> {
    const [storedState, storedEvents] = await Promise.all([
      dependencies.persistence.findSessionState(input.sessionId),
      dependencies.persistence.findBySessionId(input.sessionId),
    ]);

    if (!storedState) {
      if (storedEvents.length > 0) {
        throw new SessionRestoreError('Persisted events exist without a recoverable session state');
      }

      const useCase = new StudyUseCase(input, dependencies);
      await dependencies.persistence.saveSessionState(
        useCase.#createSessionState(useCase.getSnapshot(), dependencies.clock.now()),
      );
      return useCase;
    }

    return new StudyUseCase(input, dependencies, {
      state: storedState,
      events: storedEvents,
    });
  }

  static async restart(
    input: StartStudySessionInput,
    dependencies: StudyUseCaseDependencies,
  ): Promise<StudyUseCase> {
    await dependencies.persistence.clearSession(input.sessionId);
    return StudyUseCase.startOrResume(input, dependencies);
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
    const sessionState = this.#createSessionState(
      {
        ...snapshot,
        events: [...snapshot.events, ...events],
        judgement,
        selectedAnswer: answer,
        status: 'feedback',
      },
      answeredAt,
    );
    const committed = await this.#persistence.commitAnswer({
      idempotencyKey,
      requestFingerprint: createAnswerSubmissionFingerprint({
        sessionId: snapshot.sessionId,
        questionId: snapshot.currentItem.question.id,
        answer,
      }),
      events,
      checkpoint,
      sessionState,
    });

    return this.#flow.recordAnswer(
      committed.sessionState.selectedAnswer ?? answer,
      committed.sessionState.judgement ?? judgement,
      committed.events,
    );
  }

  async nextQuestion(): Promise<StudySessionSnapshot> {
    const snapshot = this.#flow.getSnapshot();

    if (snapshot.status !== 'feedback') {
      throw new Error('Feedback must be shown before moving to the next question');
    }

    const transitionedAt = this.#clock.now();
    const isComplete = snapshot.currentIndex === snapshot.total - 1;
    const nextStatus: StudySessionStatus = isComplete ? 'completed' : 'answering';
    const nextIndex = isComplete ? snapshot.currentIndex : snapshot.currentIndex + 1;
    const nextState = this.#createSessionState(
      {
        ...snapshot,
        currentIndex: nextIndex,
        currentItem: null,
        judgement: null,
        selectedAnswer: null,
        status: nextStatus,
      },
      transitionedAt,
    );

    await this.#persistence.saveSessionState(nextState);
    const nextSnapshot = this.#flow.next();

    if (nextSnapshot.status === 'answering') {
      this.#questionStartedAt = transitionedAt.getTime();
    }

    return nextSnapshot;
  }

  #createSessionState(snapshot: StudySessionSnapshot, updatedAt: Date): StudySessionState {
    return StudySessionStateSchema.parse({
      schemaVersion: 1,
      sessionId: snapshot.sessionId,
      userId: snapshot.userId,
      itemReferences: createItemReferences(this.#items),
      currentIndex: snapshot.currentIndex,
      status: snapshot.status,
      selectedAnswer: snapshot.selectedAnswer,
      judgement: snapshot.judgement,
      eventIds: snapshot.events.map((event) => event.id),
      updatedAt: updatedAt.toISOString(),
    });
  }

  #validateRestoredState(input: StartStudySessionInput, state: StudySessionState): void {
    if (state.sessionId !== input.sessionId || state.userId !== input.userId) {
      throw new SessionRestoreError('Stored session identity does not match the requested session');
    }

    const expectedReferences = createItemReferences(input.items);

    if (JSON.stringify(state.itemReferences) !== JSON.stringify(expectedReferences)) {
      throw new SessionRestoreError(
        'Stored session questions do not match the current question set',
      );
    }
  }
}
