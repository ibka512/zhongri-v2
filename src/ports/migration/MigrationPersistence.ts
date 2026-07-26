import type {
  ActiveMigrationDatasetPointer,
  MigrationArchiveRecord,
  MigrationRun,
  MigrationStagingDataset,
} from '../../schemas/v1';

export interface StageMigrationInput {
  run: MigrationRun;
  dataset: MigrationStagingDataset;
}

export interface StageMigrationResult {
  status: 'staged' | 'replayed';
  run: MigrationRun;
  dataset: MigrationStagingDataset;
}

export interface CommitMigrationInput {
  migrationId: string;
  committedAt: string;
  commitMarker: string;
}

export interface CommitMigrationResult {
  status: 'committed' | 'replayed';
  run: MigrationRun;
  pointer: ActiveMigrationDatasetPointer;
}

export interface RollbackMigrationInput {
  migrationId: string;
  rolledBackAt: string;
  commitMarker: string;
}

export interface RollbackMigrationResult {
  status: 'rolled-back' | 'replayed';
  run: MigrationRun;
  pointer: ActiveMigrationDatasetPointer;
}

export interface MigrationPersistencePort {
  stageMigration: (input: StageMigrationInput) => Promise<StageMigrationResult>;
  commitMigration: (input: CommitMigrationInput) => Promise<CommitMigrationResult>;
  rollbackMigration: (input: RollbackMigrationInput) => Promise<RollbackMigrationResult>;
  findMigrationRun: (migrationId: string) => Promise<MigrationRun | null>;
  findMigrationDataset: (datasetId: string) => Promise<MigrationStagingDataset | null>;
  findMigrationArchives: (migrationId: string) => Promise<readonly MigrationArchiveRecord[]>;
  getActiveMigrationDatasetPointer: () => Promise<ActiveMigrationDatasetPointer>;
}

export class MigrationStateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationStateConflictError';
  }
}
