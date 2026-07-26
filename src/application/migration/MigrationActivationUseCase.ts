import type { CommitMigrationResult, MigrationPersistencePort } from '../../ports';
import {
  MigrationVerificationReportSchema,
  type MigrationVerificationReport,
} from '../../schemas/v1';

export interface MigrationActivationDependencies {
  persistence: MigrationPersistencePort;
  now: () => Date;
}

export interface ActivateMigrationInput {
  migrationId: string;
  verificationReport: MigrationVerificationReport;
}

export class MigrationActivationBlockedError extends Error {
  constructor(
    readonly code:
      | 'INVALID_VERIFICATION_REPORT'
      | 'VERIFICATION_FAILED'
      | 'MIGRATION_NOT_STAGED'
      | 'SOURCE_MISMATCH'
      | 'ISOLATED_DATASET_REQUIRED',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationActivationBlockedError';
  }
}

export class MigrationActivationUseCase {
  constructor(private readonly dependencies: MigrationActivationDependencies) {}

  async activate(input: ActivateMigrationInput): Promise<CommitMigrationResult> {
    let verificationReport: MigrationVerificationReport;
    try {
      verificationReport = MigrationVerificationReportSchema.parse(input.verificationReport);
    } catch {
      throw new MigrationActivationBlockedError(
        'INVALID_VERIFICATION_REPORT',
        '激活所需的 V01–V25 验证报告不符合契约。',
      );
    }
    if (verificationReport.migrationId !== input.migrationId) {
      throw new MigrationActivationBlockedError(
        'SOURCE_MISMATCH',
        '验证报告的 migrationId 与激活请求不一致。',
      );
    }
    if (!verificationReport.passed || verificationReport.blockingCheckIds.length > 0) {
      throw new MigrationActivationBlockedError(
        'VERIFICATION_FAILED',
        `V01–V25 尚未全部通过，不能激活：${verificationReport.blockingCheckIds.join(', ') || '存在未通过检查'}。`,
      );
    }

    const run = await this.dependencies.persistence.findMigrationRun(input.migrationId);
    if (!run) {
      throw new MigrationActivationBlockedError(
        'MIGRATION_NOT_STAGED',
        `迁移 ${input.migrationId} 尚未进入 staging。`,
      );
    }
    const dataset = await this.dependencies.persistence.findMigrationDataset(run.datasetId);
    if (!dataset) {
      throw new MigrationActivationBlockedError(
        'MIGRATION_NOT_STAGED',
        `迁移数据集 ${run.datasetId} 不存在。`,
      );
    }
    if (
      run.sourceFingerprint !== verificationReport.sourceFingerprint ||
      dataset.sourceFingerprint !== verificationReport.sourceFingerprint
    ) {
      throw new MigrationActivationBlockedError(
        'SOURCE_MISMATCH',
        '验证报告与 staged sourceFingerprint 不一致。',
      );
    }
    if (!dataset.isolatedDomainSlice) {
      throw new MigrationActivationBlockedError(
        'ISOLATED_DATASET_REQUIRED',
        '只有包含 isolated domain payload 的数据集才能进入 activation gate。',
      );
    }

    const committedAt = this.dependencies.now().toISOString();
    return this.dependencies.persistence.commitMigration({
      migrationId: input.migrationId,
      committedAt,
      commitMarker: `${input.migrationId}:commit:${verificationReport.reportDigestSha256}`,
      verificationReportDigestSha256: verificationReport.reportDigestSha256,
    });
  }
}
