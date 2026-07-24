import {
  IdempotencyConflictError,
  type CommitAnswerInput,
  type CommitAnswerResult,
  type StudyPersistencePort,
} from '../../ports';
import {
  LearnerProfileSchema,
  LearningEventSchema,
  LearningProjectionSchema,
  ReviewStateSchema,
  StudySessionCheckpointSchema,
  StudySessionStateSchema,
  type Language,
  type LearnerProfile,
  type LearningEvent,
  type LearningProjection,
  type ReviewState,
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
  readonly #learnerProfiles = new Map<string, LearnerProfile>();
  readonly #reviewStates = new Map<string, ReviewState>();
  readonly #checkpoints = new Map<string, StudySessionCheckpoint>();
  readonly #sessionStates = new Map<string, StudySessionState>();
  readonly #idempotencyRecords = new Map<string, IdempotencyRecord>();
  #nextFailure: Error | null = null;

  failNextOperation(error = new Error('Injected transaction failure')): void {
    this.#nextFailure = error;
  }

  failNextCommit(error = new Error('Injected transaction failure')): void {
    this.failNextOperation(error);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.#throwNextFailure();

    for (const [eventId, event] of this.#events) {
      if (event.sessionId === sessionId) {
        this.#events.delete(eventId);
      }
    }

    this.#checkpoints.delete(sessionId);
    this.#sessionStates.delete(sessionId);

    for (const [key, record] of this.#idempotencyRecords) {
      if (record.checkpoint.sessionId === sessionId) {
        this.#idempotencyRecords.delete(key);
      }
    }
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

    this.#throwNextFailure();

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
      .sort(
        (left, right) =>
          left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
      )
      .map((event) => LearningEventSchema.parse(event));
  }

  async findByUserId(userId: string): Promise<readonly LearningEvent[]> {
    return [...this.#events.values()]
      .filter((event) => event.userId === userId)
      .sort(
        (left, right) =>
          left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
      )
      .map((event) => LearningEventSchema.parse(event));
  }

  async findLearnerProfile(userId: string, language: Language): Promise<LearnerProfile | null> {
    const profile = this.#learnerProfiles.get(`${userId}:${language}`);
    return profile ? LearnerProfileSchema.parse(profile) : null;
  }

  async listReviewStates(userId: string): Promise<readonly ReviewState[]> {
    return [...this.#reviewStates.values()]
      .filter((state) => state.userId === userId)
      .sort((left, right) => left.itemId.localeCompare(right.itemId))
      .map((state) => ReviewStateSchema.parse(state));
  }

  async replaceLearningProjection(projection: LearningProjection): Promise<LearningProjection> {
    const parsed = LearningProjectionSchema.parse(projection);
    const nextProfiles = new Map(this.#learnerProfiles);
    const nextReviewStates = new Map(this.#reviewStates);

    nextProfiles.set(`${parsed.profile.userId}:${parsed.profile.language}`, parsed.profile);
    for (const [reviewId, review] of nextReviewStates) {
      if (review.userId === parsed.profile.userId) {
        nextReviewStates.delete(reviewId);
      }
    }
    for (const review of parsed.reviewStates) {
      nextReviewStates.set(review.id, review);
    }

    this.#throwNextFailure();

    this.#learnerProfiles.clear();
    this.#reviewStates.clear();
    for (const [key, profile] of nextProfiles) {
      this.#learnerProfiles.set(key, profile);
    }
    for (const [key, review] of nextReviewStates) {
      this.#reviewStates.set(key, review);
    }

    return parsed;
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

    this.#throwNextFailure();

    this.#sessionStates.set(parsed.sessionId, parsed);
    return parsed;
  }

  #throwNextFailure(): void {
    if (!this.#nextFailure) {
      return;
    }

    const failure = this.#nextFailure;
    this.#nextFailure = null;
    throw failure;
  }
}
