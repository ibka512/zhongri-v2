import type {
  CanonicalContentRepositoryPort,
  MigrationPersistencePort,
  TextDigestPort,
} from '../../ports';
import {
  MigrationDomainSliceResultSchema,
  MigrationStagingDatasetSchema,
  MigrationSourceSnapshotSchema,
  type MigrationDomainSliceResult,
  type MigrationRollbackDrillEvidence,
  type MigrationSamplingEvidence,
  type MigrationStagingDataset,
  type MigrationVerificationReport,
} from '../../schemas/v1';
import { MigrationDomainSliceUseCase } from './MigrationDomainSliceUseCase';
import { MigrationLegacySourceReaderUseCase } from './MigrationLegacySourceReaderUseCase';
import { MigrationVerificationUseCase } from './MigrationVerificationUseCase';

export interface MigrationStagedVerificationDependencies {
  content: CanonicalContentRepositoryPort;
  digest: TextDigestPort;
  persistence: MigrationPersistencePort;
}

export interface VerifyStagedMigrationInput {
  migrationId: string;
  samplingEvidence?: MigrationSamplingEvidence | null;
  rollbackDrillEvidence?: MigrationRollbackDrillEvidence | null;
}

export interface VerifyStagedMigrationResult {
  dataset: MigrationStagingDataset;
  report: MigrationVerificationReport;
  slice: MigrationDomainSliceResult;
}

export class MigrationStagedVerificationError extends Error {
  constructor(
    readonly code: 'MIGRATION_NOT_STAGED' | 'ISOLATED_DATASET_REQUIRED' | 'STAGED_PAYLOAD_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationStagedVerificationError';
  }
}

export class MigrationStagedVerificationUseCase {
  constructor(private readonly dependencies: MigrationStagedVerificationDependencies) {}

  async verify(input: VerifyStagedMigrationInput): Promise<VerifyStagedMigrationResult> {
    const run = await this.dependencies.persistence.findMigrationRun(input.migrationId);
    if (!run) {
      throw new MigrationStagedVerificationError(
        'MIGRATION_NOT_STAGED',
        `迁移 ${input.migrationId} 尚未进入 staging。`,
      );
    }
    const dataset = await this.dependencies.persistence.findMigrationDataset(run.datasetId);
    if (!dataset) {
      throw new MigrationStagedVerificationError(
        'MIGRATION_NOT_STAGED',
        `迁移数据集 ${run.datasetId} 不存在。`,
      );
    }
    const parsedDataset = MigrationStagingDatasetSchema.parse(dataset);
    if (!parsedDataset.isolatedDomainSlice) {
      throw new MigrationStagedVerificationError(
        'ISOLATED_DATASET_REQUIRED',
        '只有包含 isolated domain payload 的 staging 才能生成逐域验证报告。',
      );
    }

    const sourceSnapshot = parsedDataset.sourceSnapshot
      ? MigrationSourceSnapshotSchema.parse(parsedDataset.sourceSnapshot)
      : null;
    const source = await new MigrationLegacySourceReaderUseCase({
      digest: this.dependencies.digest,
    }).read({
      migrationId: run.migrationId,
      sourceFingerprint: run.sourceFingerprint,
      sourceFileName: run.sourceFileName,
      sanitizedSourceText: parsedDataset.sanitizedSourceText,
      sourceSelection: sourceSnapshot ? 'device' : 'backup',
      sourceSnapshot,
    });
    const domainSliceUseCase = new MigrationDomainSliceUseCase({
      content: this.dependencies.content,
      digest: this.dependencies.digest,
    });
    const slice = MigrationDomainSliceResultSchema.parse(
      await domainSliceUseCase.create({ source }),
    );
    const replaySlice = MigrationDomainSliceResultSchema.parse(
      await domainSliceUseCase.create({ source }),
    );
    const storedPayload = parsedDataset.isolatedDomainSlice;
    if (
      slice.isolatedPayload.payloadDigestSha256 !== storedPayload.payloadDigestSha256 ||
      replaySlice.isolatedPayload.payloadDigestSha256 !== storedPayload.payloadDigestSha256
    ) {
      throw new MigrationStagedVerificationError(
        'STAGED_PAYLOAD_MISMATCH',
        '重新生成的 isolated payload digest 与 staged 数据不一致，拒绝生成激活报告。',
      );
    }

    const report = await new MigrationVerificationUseCase({
      content: this.dependencies.content,
      digest: this.dependencies.digest,
    }).create({
      source,
      slice,
      replaySlice,
      samplingEvidence: input.samplingEvidence ?? null,
      rollbackDrillEvidence: input.rollbackDrillEvidence ?? null,
    });

    return { dataset: parsedDataset, report, slice };
  }
}
