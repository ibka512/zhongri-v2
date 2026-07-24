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
  type LearningEvent,
  type StudySessionCheckpoint,
} from '../../schemas/v1';

interface IdempotencyRecord {
  key: string;
  fingerprint: string;
  eventIds: string[];
  checkpoint: StudySessionCheckpoint;
}

export class DexieStudyPersistence extends Dexie implements StudyPersistencePort {
  readonly learningEvents!: Table<LearningEvent, string>;
  readonly sessionCheckpoints!: Table<StudySessionCheckpoint, string>;
  readonly idempotencyRecords!: Table<IdempotencyRecord, string>;

  constructor(databaseName = 'zhongri-v2', options?: DexieOptions) {
    super(databaseName, options);

    this.version(1).stores({
      learningEvents: '&id, sessionId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
    });
  }

  async commitAnswer(input: CommitAnswerInput): Promise<CommitAnswerResult> {
    return this.transaction(
      'rw',
      [this.learningEvents, this.sessionCheckpoints, this.idempotencyRecords],
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
          };
        }

        const events = input.events.map((event) => LearningEventSchema.parse(event));
        const checkpoint = StudySessionCheckpointSchema.parse(input.checkpoint);

        await this.learningEvents.bulkAdd(events);
        await this.sessionCheckpoints.put(checkpoint);
        await this.idempotencyRecords.add({
          key: input.idempotencyKey,
          fingerprint: input.requestFingerprint,
          eventIds: events.map((event) => event.id),
          checkpoint,
        });

        return {
          status: 'committed',
          events,
          checkpoint,
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
}
