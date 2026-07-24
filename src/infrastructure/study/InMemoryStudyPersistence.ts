import {
  IdempotencyConflictError,
  type CommitAnswerInput,
  type CommitAnswerResult,
  type StudyPersistencePort,
} from '../../ports';
import {
  LearningEventSchema,
  StudySessionCheckpointSchema,
  StudySessionStateSchema,
  type LearningEvent,
  type StudySessionCheckpoint,
  type StudySessionState,
} from '../../schemas/v1';

interface IdempotencyRecord {
  fingerprint: string;
  eventIds: readonly string[];
  checkpoint: StudySessionCheckpoint;
  sessionState: StudySessionState;
}

export class InMemoryStudyPersistence implements StudyPersistencePort {
  readonly #events = new Map<string, LearningEvent>();
  readonly #checkpoints = new Map<string, StudySessionCheckpoint>();
  readonly #sessionStates = new Map<string, StudySessionState>();
  readonly #idempotencyRecords = new Map<string, IdempotencyRecord>();
  #nextFailure: Error | null = null;

  failNextCommit(error = new Error('Injected transaction failure')): void {
    this.#nextFailure = error;
  }

  async commitAnswer(input: CommitAnswerInput): Promise<CommitAnswerResult> {
    const existingRecord = this.#idempotencyRecords.get(input.idempotencyKey);

    if (existingRecord) {
      if (existingRecord.fingerprint !== input.requestFingerprint) {
        throw new IdempotencyConflictError(input.idempotencyKey);
      }

      const events = existingRecord.eventIds.map((eventId) => {
        const event = this.#events.get(eventId);

        if (!event) {
          throw new Error(`Committed event "${eventId}" is missing`);
        }

        return LearningEventSchema.parse(event);
      });
      return {
        status: 'replayed',
        events,
        checkpoint: StudySessionCheckpointSchema.parse(existingRecord.checkpoint),
        sessionState: StudySessionStateSchema.parse(existingRecord.sessionState),
      };
    }

    const events = input.events.map((event) => LearningEventSchema.parse(event));
    const checkpoint = StudySessionCheckpointSchema.parse(input.checkpoint);
    const sessionState = StudySessionStateSchema.parse(input.sessionState);

    for (const event of events) {
      if (this.#events.has(event.id)) {
        throw new Error(`LearningEvent "${event.id}" already exists`);
      }
    }

    if (this.#nextFailure) {
      const failure = this.#nextFailure;
      this.#nextFailure = null;
      throw failure;
    }

    for (const event of events) {
      this.#events.set(event.id, event);
    }

    this.#checkpoints.set(checkpoint.sessionId, checkpoint);
    this.#sessionStates.set(sessionState.sessionId, sessionState);
    this.#idempotencyRecords.set(input.idempotencyKey, {
      fingerprint: input.requestFingerprint,
      eventIds: events.map((event) => event.id),
      checkpoint,
      sessionState,
    });

    return {
      status: 'committed',
      events,
      checkpoint,
      sessionState,
    };
  }

  async findBySessionId(sessionId: string): Promise<readonly LearningEvent[]> {
    return [...this.#events.values()]
      .filter((event) => event.sessionId === sessionId)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .map((event) => LearningEventSchema.parse(event));
  }

  async findCheckpoint(sessionId: string): Promise<StudySessionCheckpoint | null> {
    const checkpoint = this.#checkpoints.get(sessionId);
    return checkpoint ? StudySessionCheckpointSchema.parse(checkpoint) : null;
  }

  async findSessionState(sessionId: string): Promise<StudySessionState | null> {
    const state = this.#sessionStates.get(sessionId);
    return state ? StudySessionStateSchema.parse(state) : null;
  }

  async saveSessionState(state: StudySessionState): Promise<StudySessionState> {
    const parsed = StudySessionStateSchema.parse(state);

    if (this.#nextFailure) {
      const failure = this.#nextFailure;
      this.#nextFailure = null;
      throw failure;
    }

    this.#sessionStates.set(parsed.sessionId, parsed);
    return parsed;
  }
}
