import type {
  CommitMigrationResult,
  MigrationPersistencePort,
  RollbackMigrationResult,
  StageMigrationResult,
  TextDigestPort,
} from '../../ports';
import {
  MigrationPreviewReportSchema,
  MigrationIsolatedPayloadSchema,
  MigrationRunSchema,
  MigrationSourceSnapshotSchema,
  MigrationStagingDatasetSchema,
  type MigrationPreviewReport,
  type MigrationIsolatedPayload,
  type MigrationSourceSnapshot,
} from '../../schemas/v1';

export interface StageV1BackupInput {
  report: MigrationPreviewReport;
  text: string;
  sourceSnapshot?: MigrationSourceSnapshot | null;
  isolatedDomainSlice?: MigrationIsolatedPayload | null;
}

export interface MigrationStagingDependencies {
  digest: TextDigestPort;
  now: () => Date;
  persistence: MigrationPersistencePort;
}

export class MigrationStagingInputError extends Error {
  constructor(
    readonly code:
      | 'BLOCKED_REPORT'
      | 'INVALID_SOURCE'
      | 'SOURCE_CHANGED'
      | 'SOURCE_TOO_DEEPLY_NESTED'
      | 'SNAPSHOT_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationStagingInputError';
  }
}

interface SanitizedValue {
  value: unknown;
  redacted: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  return key.replace(/[^a-z]/gi, '').toLowerCase() === 'deepseekapikey';
}

function sanitizeSensitiveKeys(value: unknown, depth = 0): SanitizedValue {
  if (depth > 100) {
    throw new MigrationStagingInputError(
      'SOURCE_TOO_DEEPLY_NESTED',
      '备份嵌套层级异常，无法安全创建暂存。',
    );
  }

  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizeSensitiveKeys(item, depth + 1));
    return {
      value: sanitized.map((item) => item.value),
      redacted: sanitized.some((item) => item.redacted),
    };
  }

  if (!isRecord(value)) {
    return { value, redacted: false };
  }

  let redacted = false;
  const entries = Object.entries(value).map<[string, unknown]>(([key, nested]) => {
    if (isSensitiveKey(key)) {
      redacted = true;
      return [key, '[REDACTED]'];
    }

    const sanitized = sanitizeSensitiveKeys(nested, depth + 1);
    redacted ||= sanitized.redacted;
    return [key, sanitized.value];
  });

  return { value: Object.fromEntries(entries), redacted };
}

function createMigrationId(sourceFingerprint: string): string {
  return `v1-v2:${sourceFingerprint.slice(0, 24)}:spec-1`;
}

export class MigrationStagingUseCase {
  constructor(private readonly dependencies: MigrationStagingDependencies) {}

  async stage(input: StageV1BackupInput): Promise<StageMigrationResult> {
    const report = MigrationPreviewReportSchema.parse(input.report);
    if (report.status === 'blocked') {
      throw new MigrationStagingInputError(
        'BLOCKED_REPORT',
        '这份备份仍有阻断问题，不能创建迁移暂存。',
      );
    }

    let source: unknown;
    try {
      source = JSON.parse(input.text);
    } catch {
      throw new MigrationStagingInputError(
        'INVALID_SOURCE',
        '备份内容已无法解析，请重新选择并运行预检。',
      );
    }

    const sourceSnapshot = input.sourceSnapshot
      ? MigrationSourceSnapshotSchema.parse(input.sourceSnapshot)
      : null;
    const sanitized = sourceSnapshot ? null : sanitizeSensitiveKeys(source);
    const sanitizedSourceText =
      sourceSnapshot?.selectedBackup?.sanitizedText ?? JSON.stringify(sanitized?.value);
    const reportText = JSON.stringify(report);
    if (!sanitizedSourceText) {
      throw new MigrationStagingInputError(
        'INVALID_SOURCE',
        '备份内容无法生成脱敏暂存文本，请重新选择并运行预检。',
      );
    }

    const [rawBackupDigest, sanitizedDigest, reportDigestSha256, pointer] = await Promise.all([
      this.dependencies.digest.sha256(input.text),
      this.dependencies.digest.sha256(sanitizedSourceText),
      this.dependencies.digest.sha256(reportText),
      this.dependencies.persistence.getActiveMigrationDatasetPointer(),
    ]);

    if (rawBackupDigest !== report.source.fileDigestSha256) {
      throw new MigrationStagingInputError(
        'SOURCE_CHANGED',
        '备份内容与预检报告不一致，请重新运行预检。',
      );
    }

    if (sourceSnapshot) {
      const selectedBackup = sourceSnapshot.selectedBackup;
      if (
        !selectedBackup ||
        selectedBackup.fileName !== report.source.fileName ||
        selectedBackup.rawDigestSha256 !== rawBackupDigest ||
        selectedBackup.sanitizedDigestSha256 !== sanitizedDigest
      ) {
        throw new MigrationStagingInputError(
          'SNAPSHOT_MISMATCH',
          '来源快照与当前预检备份不一致，请重新读取来源并运行预检。',
        );
      }
    }

    const sourceFingerprint = sourceSnapshot?.sourceFingerprint ?? rawBackupDigest;
    const snapshotDigestSha256 = sourceSnapshot?.snapshotDigestSha256 ?? sanitizedDigest;
    const containsRedactedSecrets = sourceSnapshot
      ? sourceSnapshot.sensitiveKeyPresence.some((entry) => entry.present)
      : (sanitized?.redacted ?? false);

    const now = this.dependencies.now().toISOString();
    const migrationId = createMigrationId(sourceFingerprint);
    const datasetId = `dataset:${migrationId}`;
    const validation = { passed: true, errors: [] } as const;
    let isolatedDomainSlice: MigrationIsolatedPayload | null = null;
    if (input.isolatedDomainSlice) {
      try {
        isolatedDomainSlice = MigrationIsolatedPayloadSchema.parse(input.isolatedDomainSlice);
      } catch {
        throw new MigrationStagingInputError(
          'INVALID_SOURCE',
          'isolated domain slice 不符合 staging 契约，请重新生成迁移结果。',
        );
      }
    }
    const dataset = MigrationStagingDatasetSchema.parse({
      schemaVersion: 1,
      datasetId,
      migrationId,
      sourceFingerprint,
      sanitizedSourceText,
      snapshotDigestSha256,
      reportDigestSha256,
      sourceSnapshot,
      previewReport: report,
      isolatedDomainSlice,
      validation,
      createdAt: now,
    });
    const run = MigrationRunSchema.parse({
      schemaVersion: 1,
      migrationId,
      specVersion: 1,
      datasetId,
      sourceFingerprint,
      sourceFileName: report.source.fileName,
      sourceFormat: report.source.format,
      backupVersion: report.source.backupVersion,
      status: 'VALIDATING',
      lastCompletedPhase: 'validation',
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      rolledBackAt: null,
      priorActiveDatasetId: pointer.activeDatasetId,
      commitMarker: null,
      snapshotDigestSha256,
      reportDigestSha256,
      containsRedactedSecrets,
      validation,
    });

    return this.dependencies.persistence.stageMigration({ run, dataset });
  }

  commit(migrationId: string): Promise<CommitMigrationResult> {
    const committedAt = this.dependencies.now().toISOString();
    return this.dependencies.persistence.commitMigration({
      migrationId,
      committedAt,
      commitMarker: `${migrationId}:commit`,
    });
  }

  rollback(migrationId: string): Promise<RollbackMigrationResult> {
    const rolledBackAt = this.dependencies.now().toISOString();
    return this.dependencies.persistence.rollbackMigration({
      migrationId,
      rolledBackAt,
      commitMarker: `${migrationId}:rollback`,
    });
  }
}
