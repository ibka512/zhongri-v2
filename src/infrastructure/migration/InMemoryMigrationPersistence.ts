import {
  MigrationStateConflictError,
  type CommitMigrationInput,
  type CommitMigrationResult,
  type MigrationPersistencePort,
  type RollbackMigrationInput,
  type RollbackMigrationResult,
  type StageMigrationInput,
  type StageMigrationResult,
} from '../../ports';
import {
  ActiveMigrationDatasetPointerSchema,
  MigrationArchiveRecordSchema,
  MigrationRunSchema,
  MigrationStagingDatasetSchema,
  type ActiveMigrationDatasetPointer,
  type MigrationArchiveRecord,
  type MigrationRun,
  type MigrationStagingDataset,
} from '../../schemas/v1';
import { createMigrationArchiveRecords } from './MigrationArchiveRecords';

function createEmptyPointer(): ActiveMigrationDatasetPointer {
  return ActiveMigrationDatasetPointerSchema.parse({
    id: 'active-migration-dataset',
    activeDatasetId: null,
    commitMarker: null,
    updatedAt: null,
  });
}

function isSameStagingInput(
  existingRun: MigrationRun,
  existingDataset: MigrationStagingDataset,
  input: StageMigrationInput,
): boolean {
  return (
    existingRun.sourceFingerprint === input.run.sourceFingerprint &&
    existingRun.snapshotDigestSha256 === input.run.snapshotDigestSha256 &&
    existingRun.reportDigestSha256 === input.run.reportDigestSha256 &&
    existingDataset.snapshotDigestSha256 === input.dataset.snapshotDigestSha256 &&
    existingDataset.reportDigestSha256 === input.dataset.reportDigestSha256 &&
    existingDataset.isolatedDomainSlice?.payloadDigestSha256 ===
      input.dataset.isolatedDomainSlice?.payloadDigestSha256
  );
}

export class InMemoryMigrationPersistence implements MigrationPersistencePort {
  readonly #runs = new Map<string, MigrationRun>();
  readonly #datasets = new Map<string, MigrationStagingDataset>();
  readonly #archives = new Map<string, MigrationArchiveRecord>();
  #pointer = createEmptyPointer();
  #nextFailure: Error | null = null;

  failNextOperation(error = new Error('Injected migration transaction failure')): void {
    this.#nextFailure = error;
  }

  async stageMigration(input: StageMigrationInput): Promise<StageMigrationResult> {
    const run = MigrationRunSchema.parse(input.run);
    const dataset = MigrationStagingDatasetSchema.parse(input.dataset);
    const archives = createMigrationArchiveRecords(dataset);
    const existingRun = this.#runs.get(run.migrationId);
    const existingDataset = this.#datasets.get(dataset.datasetId);

    if (existingRun || existingDataset) {
      if (
        existingRun &&
        existingDataset &&
        isSameStagingInput(existingRun, existingDataset, { run, dataset })
      ) {
        if (existingRun.status === 'ROLLED_BACK') {
          this.#throwNextFailure();
          this.#runs.set(run.migrationId, run);
          this.#datasets.set(dataset.datasetId, dataset);
          for (const archive of archives) {
            this.#archives.set(archive.archiveRef, archive);
          }
          return { status: 'staged', run, dataset };
        }

        for (const archive of archives) {
          this.#archives.set(archive.archiveRef, archive);
        }
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

    this.#throwNextFailure();
    this.#runs.set(run.migrationId, run);
    this.#datasets.set(dataset.datasetId, dataset);
    for (const archive of archives) {
      this.#archives.set(archive.archiveRef, archive);
    }

    return { status: 'staged', run, dataset };
  }

  async commitMigration(input: CommitMigrationInput): Promise<CommitMigrationResult> {
    const existing = this.#runs.get(input.migrationId);
    if (!existing) {
      throw new MigrationStateConflictError(`Migration "${input.migrationId}" is not staged`);
    }

    const run = MigrationRunSchema.parse(existing);
    const dataset = this.#datasets.get(run.datasetId);
    if (!dataset) {
      throw new MigrationStateConflictError(`Dataset "${run.datasetId}" is missing`);
    }

    if (run.status === 'COMPLETED') {
      if (this.#pointer.activeDatasetId !== run.datasetId) {
        throw new MigrationStateConflictError(
          `Completed migration "${run.migrationId}" is not the active dataset`,
        );
      }

      return {
        status: 'replayed',
        run,
        pointer: ActiveMigrationDatasetPointerSchema.parse(this.#pointer),
      };
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
      priorActiveDatasetId: this.#pointer.activeDatasetId,
      commitMarker: input.commitMarker,
    });
    const pointer = ActiveMigrationDatasetPointerSchema.parse({
      id: 'active-migration-dataset',
      activeDatasetId: run.datasetId,
      commitMarker: input.commitMarker,
      updatedAt: input.committedAt,
    });

    this.#throwNextFailure();
    this.#runs.set(run.migrationId, committedRun);
    this.#pointer = pointer;

    return { status: 'committed', run: committedRun, pointer };
  }

  async rollbackMigration(input: RollbackMigrationInput): Promise<RollbackMigrationResult> {
    const existing = this.#runs.get(input.migrationId);
    if (!existing) {
      throw new MigrationStateConflictError(`Migration "${input.migrationId}" does not exist`);
    }

    const run = MigrationRunSchema.parse(existing);

    if (run.status === 'ROLLED_BACK') {
      if (this.#pointer.activeDatasetId !== run.priorActiveDatasetId) {
        throw new MigrationStateConflictError(
          `Rolled back migration "${run.migrationId}" has an inconsistent active pointer`,
        );
      }

      return {
        status: 'replayed',
        run,
        pointer: ActiveMigrationDatasetPointerSchema.parse(this.#pointer),
      };
    }

    if (run.status !== 'COMPLETED' || this.#pointer.activeDatasetId !== run.datasetId) {
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

    this.#throwNextFailure();
    this.#runs.set(run.migrationId, rolledBackRun);
    this.#pointer = pointer;

    return { status: 'rolled-back', run: rolledBackRun, pointer };
  }

  async findMigrationRun(migrationId: string): Promise<MigrationRun | null> {
    const run = this.#runs.get(migrationId);
    return run ? MigrationRunSchema.parse(run) : null;
  }

  async findMigrationDataset(datasetId: string): Promise<MigrationStagingDataset | null> {
    const dataset = this.#datasets.get(datasetId);
    return dataset ? MigrationStagingDatasetSchema.parse(dataset) : null;
  }

  async findMigrationArchives(migrationId: string): Promise<readonly MigrationArchiveRecord[]> {
    return [...this.#archives.values()]
      .filter((archive) => archive.migrationId === migrationId)
      .sort((left, right) => left.archiveRef.localeCompare(right.archiveRef))
      .map((archive) => MigrationArchiveRecordSchema.parse(archive));
  }

  async getActiveMigrationDatasetPointer(): Promise<ActiveMigrationDatasetPointer> {
    return ActiveMigrationDatasetPointerSchema.parse(this.#pointer);
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
