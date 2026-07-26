import type {
  MigrationFailureInjectionPort,
  StageMigrationInput,
  TextDigestPort,
} from '../../ports';
import {
  MigrationRollbackDrillEvidenceSchema,
  migrationRollbackDrillPhaseOrder,
  MigrationRunSchema,
  MigrationStagingDatasetSchema,
  type MigrationRollbackDrillEvidence,
  type MigrationRollbackDrillPhaseResult,
  type MigrationRunStatus,
} from '../../schemas/v1';

export interface MigrationRollbackDrillDependencies {
  createPersistence: () => MigrationFailureInjectionPort;
  digest: TextDigestPort;
  now: () => Date;
}

export interface CreateMigrationRollbackDrillInput {
  stage: StageMigrationInput;
}

export class MigrationRollbackDrillInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationRollbackDrillInputError';
  }
}

interface DrillState {
  activeDatasetId: string | null;
  migrationStatus: MigrationRunStatus | null;
  datasetDigest: string | null;
}

async function readState(
  persistence: MigrationFailureInjectionPort,
  migrationId: string,
  datasetId: string,
): Promise<DrillState> {
  const [pointer, run, dataset] = await Promise.all([
    persistence.getActiveMigrationDatasetPointer(),
    persistence.findMigrationRun(migrationId),
    persistence.findMigrationDataset(datasetId),
  ]);
  return {
    activeDatasetId: pointer.activeDatasetId,
    migrationStatus: run?.status ?? null,
    datasetDigest: dataset?.snapshotDigestSha256 ?? null,
  };
}

async function expectRejected(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch {
    return true;
  }
}

export class MigrationRollbackDrillUseCase {
  constructor(private readonly dependencies: MigrationRollbackDrillDependencies) {}

  async create(input: CreateMigrationRollbackDrillInput): Promise<MigrationRollbackDrillEvidence> {
    let stage: StageMigrationInput;
    try {
      stage = {
        run: MigrationRunSchema.parse(input.stage.run),
        dataset: MigrationStagingDatasetSchema.parse(input.stage.dataset),
      };
    } catch {
      throw new MigrationRollbackDrillInputError('回滚演练的 staging 输入不符合迁移契约。');
    }
    if (
      stage.run.migrationId !== stage.dataset.migrationId ||
      stage.run.datasetId !== stage.dataset.datasetId ||
      stage.run.sourceFingerprint !== stage.dataset.sourceFingerprint
    ) {
      throw new MigrationRollbackDrillInputError('回滚演练的 run、dataset 身份不一致。');
    }

    const migrationId = stage.run.migrationId;
    const datasetId = stage.run.datasetId;
    const datasetDigest = stage.dataset.snapshotDigestSha256;
    const phases: MigrationRollbackDrillPhaseResult[] = [];

    {
      const persistence = this.dependencies.createPersistence();
      const before = await readState(persistence, migrationId, datasetId);
      persistence.failNextOperation();
      const operationRejected = await expectRejected(() => persistence.stageMigration(stage));
      const after = await readState(persistence, migrationId, datasetId);
      phases.push({
        schemaVersion: 1,
        phase: 'stage',
        failureInjected: true,
        operationRejected,
        activeDatasetIdBefore: before.activeDatasetId,
        activeDatasetIdAfter: after.activeDatasetId,
        migrationStatusBefore: before.migrationStatus,
        migrationStatusAfter: after.migrationStatus,
        datasetSnapshotDigestSha256: datasetDigest,
        passed:
          operationRejected &&
          before.activeDatasetId === null &&
          after.activeDatasetId === null &&
          after.migrationStatus === null &&
          after.datasetDigest === null,
      });
    }

    {
      const persistence = this.dependencies.createPersistence();
      await persistence.stageMigration(stage);
      const before = await readState(persistence, migrationId, datasetId);
      persistence.failNextOperation();
      const operationRejected = await expectRejected(() =>
        persistence.commitMigration({
          migrationId,
          committedAt: this.dependencies.now().toISOString(),
          commitMarker: `${migrationId}:drill:commit`,
        }),
      );
      const after = await readState(persistence, migrationId, datasetId);
      phases.push({
        schemaVersion: 1,
        phase: 'commit',
        failureInjected: true,
        operationRejected,
        activeDatasetIdBefore: before.activeDatasetId,
        activeDatasetIdAfter: after.activeDatasetId,
        migrationStatusBefore: before.migrationStatus,
        migrationStatusAfter: after.migrationStatus,
        datasetSnapshotDigestSha256: datasetDigest,
        passed:
          operationRejected &&
          before.activeDatasetId === null &&
          after.activeDatasetId === null &&
          before.migrationStatus === 'VALIDATING' &&
          after.migrationStatus === 'VALIDATING' &&
          after.datasetDigest === datasetDigest,
      });
    }

    {
      const persistence = this.dependencies.createPersistence();
      await persistence.stageMigration(stage);
      await persistence.commitMigration({
        migrationId,
        committedAt: this.dependencies.now().toISOString(),
        commitMarker: `${migrationId}:drill:commit`,
      });
      const before = await readState(persistence, migrationId, datasetId);
      persistence.failNextOperation();
      const operationRejected = await expectRejected(() =>
        persistence.rollbackMigration({
          migrationId,
          rolledBackAt: this.dependencies.now().toISOString(),
          commitMarker: `${migrationId}:drill:rollback`,
        }),
      );
      const after = await readState(persistence, migrationId, datasetId);
      phases.push({
        schemaVersion: 1,
        phase: 'rollback',
        failureInjected: true,
        operationRejected,
        activeDatasetIdBefore: before.activeDatasetId,
        activeDatasetIdAfter: after.activeDatasetId,
        migrationStatusBefore: before.migrationStatus,
        migrationStatusAfter: after.migrationStatus,
        datasetSnapshotDigestSha256: datasetDigest,
        passed:
          operationRejected &&
          before.activeDatasetId === datasetId &&
          after.activeDatasetId === datasetId &&
          before.migrationStatus === 'COMPLETED' &&
          after.migrationStatus === 'COMPLETED' &&
          after.datasetDigest === datasetDigest,
      });
    }

    const evidenceFields = {
      schemaVersion: 1 as const,
      evidenceKind: 'v1-migration-rollback-drill' as const,
      migrationId,
      sourceFingerprint: stage.run.sourceFingerprint,
      phases: migrationRollbackDrillPhaseOrder.map(
        (phase) =>
          phases.find((result) => result.phase === phase) as MigrationRollbackDrillPhaseResult,
      ),
      passed: phases.every((phase) => phase.passed),
    };
    const evidenceDigestSha256 = await this.dependencies.digest.sha256(
      JSON.stringify(evidenceFields),
    );
    return MigrationRollbackDrillEvidenceSchema.parse({ ...evidenceFields, evidenceDigestSha256 });
  }
}
