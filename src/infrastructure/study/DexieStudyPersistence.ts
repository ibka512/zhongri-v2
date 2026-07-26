import Dexie, { type DexieOptions, type Table } from 'dexie';

import {
  IdempotencyConflictError,
  MigrationStateConflictError,
  type CommitAnswerInput,
  type CommitAnswerResult,
  type CommitMigrationInput,
  type CommitMigrationResult,
  type MigrationFailureInjectionPort,
  type MigrationPersistencePort,
  type RollbackMigrationInput,
  type RollbackMigrationResult,
  type StageMigrationInput,
  type StageMigrationResult,
  type StudyPersistencePort,
} from '../../ports';
import {
  ActiveMigrationDatasetPointerSchema,
  LearnerProfileSchema,
  LearningEventSchema,
  MigrationArchiveRecordSchema,
  LearningProjectionSchema,
  MigrationRunSchema,
  MigrationStagingDatasetSchema,
  ReviewStateSchema,
  StudySessionCheckpointSchema,
  StudySessionStateSchema,
  type ActiveMigrationDatasetPointer,
  type Language,
  type LearnerProfile,
  type LearningEvent,
  type LearningProjection,
  type MigrationArchiveRecord,
  type MigrationRun,
  type MigrationStagingDataset,
  type ReviewState,
  type StudySessionCheckpoint,
  type StudySessionState,
} from '../../schemas/v1';
import { createMigrationArchiveRecords } from '../migration/MigrationArchiveRecords';

interface IdempotencyRecord {
  key: string;
  fingerprint: string;
  eventIds: string[];
  checkpoint: StudySessionCheckpoint;
  sessionState: StudySessionState;
}

function createEmptyMigrationPointer(): ActiveMigrationDatasetPointer {
  return ActiveMigrationDatasetPointerSchema.parse({
    id: 'active-migration-dataset',
    activeDatasetId: null,
    commitMarker: null,
    updatedAt: null,
  });
}

export class DexieStudyPersistence
  extends Dexie
  implements StudyPersistencePort, MigrationPersistencePort, MigrationFailureInjectionPort
{
  readonly learningEvents!: Table<LearningEvent, string>;
  readonly learnerProfiles!: Table<LearnerProfile, [string, Language]>;
  readonly reviewStates!: Table<ReviewState, string>;
  readonly sessionCheckpoints!: Table<StudySessionCheckpoint, string>;
  readonly studySessions!: Table<StudySessionState, string>;
  readonly idempotencyRecords!: Table<IdempotencyRecord, string>;
  readonly migrationRuns!: Table<MigrationRun, string>;
  readonly migrationDatasets!: Table<MigrationStagingDataset, string>;
  readonly migrationArchives!: Table<MigrationArchiveRecord, string>;
  readonly migrationPointers!: Table<ActiveMigrationDatasetPointer, string>;
  #nextMigrationFailure: Error | null = null;

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
    this.version(3).stores({
      learningEvents: '&id, sessionId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      studySessions: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
      migrationRuns: '&migrationId, sourceFingerprint, status, updatedAt',
      migrationDatasets: '&datasetId, migrationId, sourceFingerprint',
      migrationPointers: '&id',
    });
    this.version(4).stores({
      learningEvents: '&id, sessionId, userId, itemId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      studySessions: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
      migrationRuns: '&migrationId, sourceFingerprint, status, updatedAt',
      migrationDatasets: '&datasetId, migrationId, sourceFingerprint',
      migrationPointers: '&id',
      learnerProfiles: '&[userId+language], userId, language',
      reviewStates: '&id, userId, itemId, due',
    });
    this.version(5).stores({
      learningEvents: '&id, sessionId, userId, itemId, timestamp',
      sessionCheckpoints: '&sessionId, updatedAt',
      studySessions: '&sessionId, updatedAt',
      idempotencyRecords: '&key',
      migrationRuns: '&migrationId, sourceFingerprint, status, updatedAt',
      migrationDatasets: '&datasetId, migrationId, sourceFingerprint',
      migrationArchives:
        '&archiveRef, migrationId, datasetId, archiveKind, retentionPolicy, retentionUntil',
      migrationPointers: '&id',
      learnerProfiles: '&[userId+language], userId, language',
      reviewStates: '&id, userId, itemId, due',
    });
  }

  /** Acceptance-only failure injection; never call from the product flow. */
  failNextOperation(error = new Error('Injected migration transaction failure')): void {
    this.#nextMigrationFailure = error;
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

  async clearSession(sessionId: string): Promise<void> {
    await this.transaction(
      'rw',
      [this.learningEvents, this.sessionCheckpoints, this.studySessions, this.idempotencyRecords],
      async () => {
        await this.learningEvents.where('sessionId').equals(sessionId).delete();
        await this.sessionCheckpoints.delete(sessionId);
        await this.studySessions.delete(sessionId);
        await this.idempotencyRecords
          .filter((record) => record.checkpoint.sessionId === sessionId)
          .delete();
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

  async findByUserId(userId: string): Promise<readonly LearningEvent[]> {
    const events = await this.learningEvents.where('userId').equals(userId).sortBy('timestamp');
    return events
      .map((event) => LearningEventSchema.parse(event))
      .sort(
        (left, right) =>
          left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
      );
  }

  async findLearnerProfile(userId: string, language: Language): Promise<LearnerProfile | null> {
    const profile = await this.learnerProfiles.get([userId, language]);
    return profile ? LearnerProfileSchema.parse(profile) : null;
  }

  async listReviewStates(userId: string): Promise<readonly ReviewState[]> {
    const states = await this.reviewStates.where('userId').equals(userId).sortBy('itemId');
    return states.map((state) => ReviewStateSchema.parse(state));
  }

  async replaceLearningProjection(projection: LearningProjection): Promise<LearningProjection> {
    const parsed = LearningProjectionSchema.parse(projection);

    return this.transaction('rw', [this.learnerProfiles, this.reviewStates], async () => {
      await this.reviewStates.where('userId').equals(parsed.profile.userId).delete();
      await this.learnerProfiles.put(parsed.profile);
      await this.reviewStates.bulkPut(parsed.reviewStates);
      return parsed;
    });
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

  async stageMigration(input: StageMigrationInput): Promise<StageMigrationResult> {
    const run = MigrationRunSchema.parse(input.run);
    const dataset = MigrationStagingDatasetSchema.parse(input.dataset);
    const archives = createMigrationArchiveRecords(dataset);

    return this.transaction(
      'rw',
      [this.migrationRuns, this.migrationDatasets, this.migrationArchives],
      async () => {
        const [existingRun, existingDataset] = await Promise.all([
          this.migrationRuns.get(run.migrationId),
          this.migrationDatasets.get(dataset.datasetId),
        ]);

        if (existingRun || existingDataset) {
          if (
            existingRun &&
            existingDataset &&
            existingRun.sourceFingerprint === run.sourceFingerprint &&
            existingRun.snapshotDigestSha256 === run.snapshotDigestSha256 &&
            existingRun.reportDigestSha256 === run.reportDigestSha256 &&
            existingDataset.snapshotDigestSha256 === dataset.snapshotDigestSha256 &&
            existingDataset.reportDigestSha256 === dataset.reportDigestSha256 &&
            existingDataset.isolatedDomainSlice?.payloadDigestSha256 ===
              dataset.isolatedDomainSlice?.payloadDigestSha256
          ) {
            if (existingRun.status === 'ROLLED_BACK') {
              await this.migrationRuns.put(run);
              await this.migrationDatasets.put(dataset);
              await this.migrationArchives.bulkPut(archives);
              return { status: 'staged', run, dataset };
            }

            await this.migrationArchives.bulkPut(archives);
            return {
              status: 'replayed',
              run: MigrationRunSchema.parse(existingRun),
              dataset: MigrationStagingDatasetSchema.parse(existingDataset),
            };
          }

          throw new MigrationStateConflictError(
            `Migration "${run.migrationId}" already exists with different staging content`,
          );
        }

        if (run.status !== 'VALIDATING' || !run.validation.passed || !dataset.validation.passed) {
          throw new MigrationStateConflictError('Only a validated dataset can enter safe staging');
        }

        this.#throwNextMigrationFailure();
        await this.migrationRuns.add(run);
        await this.migrationDatasets.add(dataset);
        await this.migrationArchives.bulkAdd(archives);
        return { status: 'staged', run, dataset };
      },
    );
  }

  async commitMigration(input: CommitMigrationInput): Promise<CommitMigrationResult> {
    return this.transaction(
      'rw',
      [this.migrationRuns, this.migrationDatasets, this.migrationPointers],
      async () => {
        const existing = await this.migrationRuns.get(input.migrationId);
        if (!existing) {
          throw new MigrationStateConflictError(`Migration "${input.migrationId}" is not staged`);
        }

        const run = MigrationRunSchema.parse(existing);
        const [dataset, storedPointer] = await Promise.all([
          this.migrationDatasets.get(run.datasetId),
          this.migrationPointers.get('active-migration-dataset'),
        ]);
        if (!dataset) {
          throw new MigrationStateConflictError(`Dataset "${run.datasetId}" is missing`);
        }

        const currentPointer = storedPointer
          ? ActiveMigrationDatasetPointerSchema.parse(storedPointer)
          : createEmptyMigrationPointer();

        if (run.status === 'COMPLETED') {
          if (currentPointer.activeDatasetId !== run.datasetId) {
            throw new MigrationStateConflictError(
              `Completed migration "${run.migrationId}" is not the active dataset`,
            );
          }

          return { status: 'replayed', run, pointer: currentPointer };
        }

        if (run.status !== 'VALIDATING' || !run.validation.passed) {
          throw new MigrationStateConflictError(
            `Migration "${run.migrationId}" has not passed validation`,
          );
        }

        const committedRun = MigrationRunSchema.parse({
          ...run,
          status: 'COMPLETED',
          lastCompletedPhase: 'commit',
          updatedAt: input.committedAt,
          completedAt: input.committedAt,
          priorActiveDatasetId: currentPointer.activeDatasetId,
          commitMarker: input.commitMarker,
          verificationReportDigestSha256:
            input.verificationReportDigestSha256 ?? run.verificationReportDigestSha256,
        });
        const pointer = ActiveMigrationDatasetPointerSchema.parse({
          id: 'active-migration-dataset',
          activeDatasetId: run.datasetId,
          commitMarker: input.commitMarker,
          updatedAt: input.committedAt,
        });

        this.#throwNextMigrationFailure();
        await this.migrationRuns.put(committedRun);
        await this.migrationPointers.put(pointer);
        return { status: 'committed', run: committedRun, pointer };
      },
    );
  }

  async rollbackMigration(input: RollbackMigrationInput): Promise<RollbackMigrationResult> {
    return this.transaction('rw', [this.migrationRuns, this.migrationPointers], async () => {
      const existing = await this.migrationRuns.get(input.migrationId);
      if (!existing) {
        throw new MigrationStateConflictError(`Migration "${input.migrationId}" does not exist`);
      }

      const run = MigrationRunSchema.parse(existing);
      const storedPointer = await this.migrationPointers.get('active-migration-dataset');
      const currentPointer = storedPointer
        ? ActiveMigrationDatasetPointerSchema.parse(storedPointer)
        : createEmptyMigrationPointer();

      if (run.status === 'ROLLED_BACK') {
        if (currentPointer.activeDatasetId !== run.priorActiveDatasetId) {
          throw new MigrationStateConflictError(
            `Rolled back migration "${run.migrationId}" has an inconsistent active pointer`,
          );
        }

        return { status: 'replayed', run, pointer: currentPointer };
      }

      if (run.status !== 'COMPLETED' || currentPointer.activeDatasetId !== run.datasetId) {
        throw new MigrationStateConflictError(
          `Migration "${run.migrationId}" is not the active committed dataset`,
        );
      }

      const rolledBackRun = MigrationRunSchema.parse({
        ...run,
        status: 'ROLLED_BACK',
        lastCompletedPhase: 'rollback',
        updatedAt: input.rolledBackAt,
        rolledBackAt: input.rolledBackAt,
        commitMarker: input.commitMarker,
      });
      const pointer = ActiveMigrationDatasetPointerSchema.parse({
        id: 'active-migration-dataset',
        activeDatasetId: run.priorActiveDatasetId,
        commitMarker: input.commitMarker,
        updatedAt: input.rolledBackAt,
      });

      this.#throwNextMigrationFailure();
      await this.migrationRuns.put(rolledBackRun);
      await this.migrationPointers.put(pointer);
      return { status: 'rolled-back', run: rolledBackRun, pointer };
    });
  }

  async findMigrationRun(migrationId: string): Promise<MigrationRun | null> {
    const run = await this.migrationRuns.get(migrationId);
    return run ? MigrationRunSchema.parse(run) : null;
  }

  async findMigrationDataset(datasetId: string): Promise<MigrationStagingDataset | null> {
    const dataset = await this.migrationDatasets.get(datasetId);
    return dataset ? MigrationStagingDatasetSchema.parse(dataset) : null;
  }

  async findMigrationArchives(migrationId: string): Promise<readonly MigrationArchiveRecord[]> {
    const archives = await this.migrationArchives
      .where('migrationId')
      .equals(migrationId)
      .sortBy('archiveRef');
    return archives.map((archive) => MigrationArchiveRecordSchema.parse(archive));
  }

  async getActiveMigrationDatasetPointer(): Promise<ActiveMigrationDatasetPointer> {
    const pointer = await this.migrationPointers.get('active-migration-dataset');
    return pointer
      ? ActiveMigrationDatasetPointerSchema.parse(pointer)
      : createEmptyMigrationPointer();
  }

  #throwNextMigrationFailure(): void {
    if (!this.#nextMigrationFailure) {
      return;
    }
    const failure = this.#nextMigrationFailure;
    this.#nextMigrationFailure = null;
    throw failure;
  }
}
