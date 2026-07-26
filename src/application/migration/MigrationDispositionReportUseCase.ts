import type { TextDigestPort } from '../../ports';
import {
  MigrationDispositionEntrySchema,
  MigrationDispositionInputSchema,
  MigrationDispositionReportSchema,
  type MigrationDispositionEntry,
  type MigrationDispositionInput,
  type MigrationDispositionInputRecord,
  type MigrationDispositionReport,
} from '../../schemas/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface MigrationDispositionReportDependencies {
  digest: TextDigestPort;
}

export class MigrationDispositionInputError extends Error {
  constructor(
    readonly code:
      'INVALID_INPUT' | 'DUPLICATE_SOURCE_REF' | 'INVALID_DISPOSITION' | 'DIGEST_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationDispositionInputError';
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertDigest(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new MigrationDispositionInputError(
      'DIGEST_FAILED',
      `${label} 没有返回合法的 SHA-256 摘要。`,
    );
  }
}

function normalizeTargetRefs(record: MigrationDispositionInputRecord): string[] {
  const targetRefs = (record.targetRefs ?? []).map((targetRef) => targetRef.trim());
  const seen = new Set<string>();
  for (const targetRef of targetRefs) {
    if (seen.has(targetRef)) {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 的目标引用重复：${targetRef}。`,
      );
    }
    seen.add(targetRef);
  }
  return targetRefs.sort(compareStrings);
}

function validateDispositionRecord(
  record: MigrationDispositionInputRecord,
  targetRefs: readonly string[],
): void {
  const canonicalSourceRef = record.canonicalSourceRef?.trim() || null;
  const quarantineCode = record.quarantineCode?.trim() || null;
  const rawArchive = record.rawArchive ?? false;

  if (record.outcome === 'migrated') {
    if (targetRefs.length === 0 || canonicalSourceRef || quarantineCode) {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 的 migrated 处置缺少唯一目标或混入 dedupe/quarantine 字段。`,
      );
    }
  }

  if (record.outcome === 'deduped') {
    if (targetRefs.length === 0 || !canonicalSourceRef || quarantineCode) {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 的 deduped 处置必须保留 canonicalSourceRef 和目标。`,
      );
    }
  }

  if (record.outcome === 'quarantined') {
    if (targetRefs.length > 0 || canonicalSourceRef || !quarantineCode) {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 的 quarantined 处置不能创建活跃目标。`,
      );
    }
    if (record.severity === 'info') {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 的 quarantine 严重级别不能是 info。`,
      );
    }
    if (rawArchive) {
      throw new MigrationDispositionInputError(
        'INVALID_DISPOSITION',
        `来源 ${record.sourceRef} 不能同时声明 rawArchive 和 quarantine。`,
      );
    }
  }
}

async function createArchiveRef(
  dependencies: MigrationDispositionReportDependencies,
  migrationId: string,
  sourceRef: string,
  sourceRecordDigestSha256: string,
  archiveKind: 'rawArchive' | 'quarantine',
): Promise<string> {
  const digest = await dependencies.digest.sha256(
    JSON.stringify({ migrationId, sourceRef, sourceRecordDigestSha256, archiveKind }),
  );
  assertDigest(digest, `${archiveKind} 引用`);
  return `${archiveKind === 'rawArchive' ? 'raw-v1' : 'quarantine-v1'}:${digest}`;
}

function createCounts(entries: readonly MigrationDispositionEntry[]) {
  return {
    source: entries.length,
    migrated: entries.filter((entry) => entry.outcome === 'migrated').length,
    deduped: entries.filter((entry) => entry.outcome === 'deduped').length,
    quarantined: entries.filter((entry) => entry.outcome === 'quarantined').length,
    rawArchived: entries.filter((entry) => entry.archiveKind === 'rawArchive').length,
  };
}

export class MigrationDispositionReportUseCase {
  constructor(private readonly dependencies: MigrationDispositionReportDependencies) {}

  async create(input: MigrationDispositionInput): Promise<MigrationDispositionReport> {
    let parsedInput: MigrationDispositionInput;
    try {
      parsedInput = MigrationDispositionInputSchema.parse(input);
    } catch {
      throw new MigrationDispositionInputError('INVALID_INPUT', '迁移处置报告输入不符合契约。');
    }

    const sourceRefs = new Set<string>();
    for (const record of parsedInput.records) {
      const sourceRef = record.sourceRef.trim();
      if (sourceRefs.has(sourceRef)) {
        throw new MigrationDispositionInputError(
          'DUPLICATE_SOURCE_REF',
          `迁移处置来源引用重复：${sourceRef}。`,
        );
      }
      sourceRefs.add(sourceRef);
    }

    const normalizedRecords = parsedInput.records
      .map((record) => ({ ...record, sourceRef: record.sourceRef.trim() }))
      .sort((left, right) => compareStrings(left.sourceRef, right.sourceRef));
    const entries: MigrationDispositionEntry[] = [];

    for (const record of normalizedRecords) {
      const targetRefs = normalizeTargetRefs(record);
      validateDispositionRecord(record, targetRefs);

      const canonicalSourceRef = record.canonicalSourceRef?.trim() || null;
      const quarantineCode = record.quarantineCode?.trim() || null;
      const archiveKind =
        record.outcome === 'quarantined'
          ? ('quarantine' as const)
          : record.rawArchive
            ? ('rawArchive' as const)
            : null;
      const archiveRef = archiveKind
        ? await createArchiveRef(
            this.dependencies,
            parsedInput.migrationId,
            record.sourceRef,
            record.sourceRecordDigestSha256,
            archiveKind,
          )
        : null;

      try {
        entries.push(
          MigrationDispositionEntrySchema.parse({
            schemaVersion: 1,
            sourceRef: record.sourceRef,
            domain: record.domain,
            sourceRecordDigestSha256: record.sourceRecordDigestSha256,
            outcome: record.outcome,
            severity: record.severity,
            reasonCode: record.reasonCode.trim(),
            quarantineCode,
            targetRefs,
            canonicalSourceRef,
            archiveKind,
            archiveRef,
          }),
        );
      } catch {
        throw new MigrationDispositionInputError(
          'INVALID_DISPOSITION',
          `来源 ${record.sourceRef} 的迁移处置不满足语义约束。`,
        );
      }
    }

    const counts = createCounts(entries);
    const reportPayload = JSON.stringify({
      schemaVersion: 1,
      migrationId: parsedInput.migrationId,
      sourceFingerprint: parsedInput.sourceFingerprint,
      identityMapDigestSha256: parsedInput.identityMapDigestSha256,
      entries,
      counts,
    });
    const reportDigestSha256 = await this.dependencies.digest.sha256(reportPayload);
    assertDigest(reportDigestSha256, '迁移处置报告');

    return MigrationDispositionReportSchema.parse({
      schemaVersion: 1,
      migrationId: parsedInput.migrationId,
      sourceFingerprint: parsedInput.sourceFingerprint,
      identityMapDigestSha256: parsedInput.identityMapDigestSha256,
      entries,
      counts,
      reportDigestSha256,
    });
  }
}
