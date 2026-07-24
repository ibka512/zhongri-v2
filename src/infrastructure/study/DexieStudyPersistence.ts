import Dexie, { type DexieOptions, type Table } from 'dexie';

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
  key: string;
  fingerprint: string;
  eventIds: string[];
  checkpoint: StudySessionCheckpoint;
  sessionState: StudySessionState;
}

export class DexieStudyPersistence extends Dexie implements StudyPersistencePort {
  readonly learningEvents!: Table<LearningEvent, string>;
  readonly sessionCheckpoints!: Table<StudySessionCheckpoint, string>;
  readonly studySessions!: Table<StudySessionState, string>;
  readonly idempotencyRecords!: Table<IdempotencyRecord, string>;

  constructor(databaseName = 'zhongri-v2', options?: DexieOptions) {
    super(databaseName, options);

    this.version(1).stores({
      learningEvents: '&id, sessionId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
    });
    this.version(2).stores({
      learningEvents: '&id, sessionId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      studySessions: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
    });
  }

  async commitAnswer(input: CommitAnswerInput): Promise<CommitAnswerResult> {
    return this.transaction(
      'rw',
      [this.learningEvents, this.sessionCheckpoints, this.studySessions, this.idempotencyRecords],
      async () => {
        const existingRecord = await this.idempotencyRecords.get(input.idempotencyKey);

        if (existingRecord) {
          if (existingRecord.fingerprint !== input.requestFingerprint) {
            throw new IdempotencyConflictError(input.idempotencyKey);
          }

          const storedEvents = await this.learningEvents.bulkGet(existingRecord.eventIds);

          if (storedEvents.some((event) => event === undefined)) {
            throw new Error('Committed answer transaction is incomplete');
          }

          return {
            status: 'replayed',
            events: storedEvents.map((event) => LearningEventSchema.parse(event)),
            checkpoint: StudySessionCheckpointSchema.parse(existingRecord.checkpoint),
            sessionState: StudySessionStateSchema.parse(existingRecord.sessionState),
          };
        }

        const events = input.events.map((event) => LearningEventSchema.parse(event));
        const checkpoint = StudySessionCheckpointSchema.parse(input.checkpoint);
        const sessionState = StudySessionStateSchema.parse(input.sessionState);

        await this.learningEvents.bulkAdd(events);
        await this.sessionCheckpoints.put(checkpoint);
        await this.studySessions.put(sessionState);
        await this.idempotencyRecords.add({
          key: input.idempotencyKey,
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
      },
    );
  }

  async findBySessionId(sessionId: string): Promise<readonly LearningEvent[]> {
    const events = await this.learningEvents
      .where('sessionId')
      .equals(sessionId)
      .sortBy('timestamp');
    return events.map((event) => LearningEventSchema.parse(event));
  }

  async findCheckpoint(sessionId: string): Promise<StudySessionCheckpoint | null> {
    const checkpoint = await this.sessionCheckpoints.get(sessionId);
    return checkpoint ? StudySessionCheckpointSchema.parse(checkpoint) : null;
  }

  async findSessionState(sessionId: string): Promise<StudySessionState | null> {
    const state = await this.studySessions.get(sessionId);
    return state ? StudySessionStateSchema.parse(state) : null;
  }

  async saveSessionState(state: StudySessionState): Promise<StudySessionState> {
    const parsed = StudySessionStateSchema.parse(state);
    await this.studySessions.put(parsed);
    return parsed;
  }
}
