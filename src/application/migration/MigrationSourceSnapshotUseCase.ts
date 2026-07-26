import type { TextDigestPort } from '../../ports';
import {
  MigrationSourceSnapshotSchema,
  type MigrationSourceSnapshot,
  type MigrationSourceSnapshotEntry,
} from '../../schemas/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_SOURCE_SNAPSHOT_BACKUP_BYTES = 25 * 1024 * 1024;
const DEFAULT_SENSITIVE_KEYS = ['deepseekApiKey'] as const;

export interface MigrationSourceEntryInput {
  key: string;
  value: unknown;
}

export interface MigrationSelectedBackupInput {
  fileName: string;
  fileSizeBytes?: number;
  text: string;
}

export interface CaptureMigrationSourceSnapshotInput {
  indexedDb: readonly MigrationSourceEntryInput[];
  localStorage: readonly MigrationSourceEntryInput[];
  selectedBackup?: MigrationSelectedBackupInput | null;
  sourceAppVersion?: string | null;
  dataSchemaVersion?: number | null;
  wordStorageVersion?: number | null;
  canonicalManifestDigest: string;
  sensitiveKeys?: readonly string[];
}

export interface MigrationSourceSnapshotDependencies {
  digest: TextDigestPort;
  now: () => Date;
}

export class MigrationSourceSnapshotInputError extends Error {
  constructor(
    readonly code:
      | 'EMPTY_KEY'
      | 'DUPLICATE_KEY'
      | 'UNSERIALIZABLE_VALUE'
      | 'INVALID_BACKUP_JSON'
      | 'BACKUP_TOO_LARGE'
      | 'BACKUP_SIZE_MISMATCH'
      | 'INVALID_METADATA',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationSourceSnapshotInputError';
  }
}

interface SensitiveKeyDefinition {
  normalized: string;
  original: string;
}

interface RedactedValue {
  value: unknown;
  presentSensitiveKeys: Set<string>;
}

interface PreparedBackup {
  fileName: string;
  fileSizeBytes: number;
  rawDigestSha256: string;
  sanitizedDigestSha256: string;
  sanitizedText: string;
  containsSensitiveValue: boolean;
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeSourceKey(value: string): string {
  const key = value.trim();
  if (!key) {
    throw new MigrationSourceSnapshotInputError('EMPTY_KEY', 'v1 来源键不能为空。');
  }
  return key;
}

function normalizeSensitiveKeyDefinitions(
  values: readonly string[] | undefined,
): SensitiveKeyDefinition[] {
  const definitions = (values ?? DEFAULT_SENSITIVE_KEYS).map((value) => {
    const original = value.trim();
    const normalized = normalizeKey(original);
    if (!original || !normalized) {
      throw new MigrationSourceSnapshotInputError('INVALID_METADATA', '敏感字段名不能为空。');
    }
    return { normalized, original };
  });

  const unique = new Map<string, SensitiveKeyDefinition>();
  for (const definition of definitions) {
    if (unique.has(definition.normalized)) {
      throw new MigrationSourceSnapshotInputError(
        'INVALID_METADATA',
        `敏感字段名重复：${definition.original}。`,
      );
    }
    unique.set(definition.normalized, definition);
  }

  return [...unique.values()].sort((left, right) =>
    left.normalized.localeCompare(right.normalized),
  );
}

function canonicalizeValue(
  value: unknown,
  sensitiveKeys: ReadonlyMap<string, SensitiveKeyDefinition>,
  presentSensitiveKeys: Set<string>,
  seen: WeakSet<object>,
): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MigrationSourceSnapshotInputError(
        'UNSERIALIZABLE_VALUE',
        'v1 来源包含不可序列化的非有限数字。',
      );
    }
    return value;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new MigrationSourceSnapshotInputError('UNSERIALIZABLE_VALUE', 'v1 来源包含无效日期。');
    }
    return value.toISOString();
  }

  if (typeof value !== 'object' || value === null) {
    throw new MigrationSourceSnapshotInputError(
      'UNSERIALIZABLE_VALUE',
      'v1 来源包含无法安全序列化的值。',
    );
  }

  if (seen.has(value)) {
    throw new MigrationSourceSnapshotInputError(
      'UNSERIALIZABLE_VALUE',
      'v1 来源包含循环引用，无法创建稳定快照。',
    );
  }
  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item) =>
        canonicalizeValue(item, sensitiveKeys, presentSensitiveKeys, seen),
      );
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new MigrationSourceSnapshotInputError(
        'UNSERIALIZABLE_VALUE',
        'v1 来源包含不支持的对象类型。',
      );
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const sensitiveDefinition = sensitiveKeys.get(normalizeKey(key));
      if (sensitiveDefinition) {
        presentSensitiveKeys.add(sensitiveDefinition.normalized);
        result[key] = '[REDACTED]';
        continue;
      }

      result[key] = canonicalizeValue(
        (value as Record<string, unknown>)[key],
        sensitiveKeys,
        presentSensitiveKeys,
        seen,
      );
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function serializeCanonicalValue(
  value: unknown,
  sensitiveKeys: ReadonlyMap<string, SensitiveKeyDefinition>,
  presentSensitiveKeys: Set<string>,
): string {
  const serialized = JSON.stringify(
    canonicalizeValue(value, sensitiveKeys, presentSensitiveKeys, new WeakSet()),
  );
  if (serialized === undefined) {
    throw new MigrationSourceSnapshotInputError(
      'UNSERIALIZABLE_VALUE',
      'v1 来源无法生成稳定 JSON 快照。',
    );
  }
  return serialized;
}

function prepareEntries(
  entries: readonly MigrationSourceEntryInput[],
  sensitiveKeys: ReadonlyMap<string, SensitiveKeyDefinition>,
  presentSensitiveKeys: Set<string>,
): MigrationSourceSnapshotEntry[] {
  const seenKeys = new Set<string>();
  const prepared = entries.map((entry) => {
    const key = normalizeSourceKey(entry.key);
    if (seenKeys.has(key)) {
      throw new MigrationSourceSnapshotInputError('DUPLICATE_KEY', `v1 来源包含重复键：${key}。`);
    }
    seenKeys.add(key);

    const sensitiveDefinition = sensitiveKeys.get(normalizeKey(key));
    if (sensitiveDefinition) {
      presentSensitiveKeys.add(sensitiveDefinition.normalized);
      return { key, serializedValue: JSON.stringify('[REDACTED]') };
    }

    return {
      key,
      serializedValue: serializeCanonicalValue(entry.value, sensitiveKeys, presentSensitiveKeys),
    };
  });

  return prepared.sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeNullableString(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new MigrationSourceSnapshotInputError('INVALID_METADATA', `${field} 不能为空字符串。`);
  }
  return normalized;
}

function normalizeNullableVersion(value: number | null | undefined, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new MigrationSourceSnapshotInputError('INVALID_METADATA', `${field} 必须是非负整数。`);
  }
  return value;
}

function createSensitivePresence(
  definitions: readonly SensitiveKeyDefinition[],
  presentSensitiveKeys: ReadonlySet<string>,
) {
  return definitions.map((definition) => ({
    key: definition.original,
    present: presentSensitiveKeys.has(definition.normalized),
  }));
}

function createSnapshotDigestPayload(input: {
  sourceAppVersion: string | null;
  dataSchemaVersion: number | null;
  wordStorageVersion: number | null;
  indexedDb: readonly MigrationSourceSnapshotEntry[];
  localStorage: readonly MigrationSourceSnapshotEntry[];
  selectedBackup: Pick<PreparedBackup, 'sanitizedDigestSha256' | 'sanitizedText'> | null;
  canonicalManifestDigest: string;
  sensitiveKeyPresence: ReturnType<typeof createSensitivePresence>;
}) {
  return {
    schemaVersion: 1,
    snapshotKind: 'v1-source-snapshot',
    sourceAppVersion: input.sourceAppVersion,
    dataSchemaVersion: input.dataSchemaVersion,
    wordStorageVersion: input.wordStorageVersion,
    indexedDb: input.indexedDb,
    localStorage: input.localStorage,
    selectedBackup: input.selectedBackup,
    canonicalManifestDigest: input.canonicalManifestDigest,
    sensitiveKeyPresence: input.sensitiveKeyPresence,
  };
}

function createSourceFingerprintPayload(input: {
  sourceAppVersion: string | null;
  dataSchemaVersion: number | null;
  wordStorageVersion: number | null;
  indexedDb: readonly MigrationSourceSnapshotEntry[];
  localStorage: readonly MigrationSourceSnapshotEntry[];
  selectedBackupFingerprintDigest: string | null;
  canonicalManifestDigest: string;
  sensitiveKeyPresence: ReturnType<typeof createSensitivePresence>;
}) {
  return {
    version: 'v1-source-fingerprint',
    sourceAppVersion: input.sourceAppVersion,
    dataSchemaVersion: input.dataSchemaVersion,
    wordStorageVersion: input.wordStorageVersion,
    indexedDb: input.indexedDb,
    localStorage: input.localStorage,
    selectedBackupFingerprintDigest: input.selectedBackupFingerprintDigest,
    canonicalManifestDigest: input.canonicalManifestDigest,
    sensitiveKeyPresence: input.sensitiveKeyPresence,
  };
}

export class MigrationSourceSnapshotUseCase {
  constructor(private readonly dependencies: MigrationSourceSnapshotDependencies) {}

  async capture(input: CaptureMigrationSourceSnapshotInput): Promise<MigrationSourceSnapshot> {
    if (!SHA256_PATTERN.test(input.canonicalManifestDigest)) {
      throw new MigrationSourceSnapshotInputError(
        'INVALID_METADATA',
        'canonical manifest digest 必须是 64 位小写 SHA-256。',
      );
    }

    const sensitiveDefinitions = normalizeSensitiveKeyDefinitions(input.sensitiveKeys);
    const sensitiveKeys = new Map(
      sensitiveDefinitions.map((definition) => [definition.normalized, definition]),
    );
    const presentSensitiveKeys = new Set<string>();
    const indexedDb = prepareEntries(input.indexedDb, sensitiveKeys, presentSensitiveKeys);
    const localStorage = prepareEntries(input.localStorage, sensitiveKeys, presentSensitiveKeys);
    const selectedBackup = await this.prepareBackup(
      input.selectedBackup ?? null,
      sensitiveKeys,
      presentSensitiveKeys,
    );
    const sourceAppVersion = normalizeNullableString(input.sourceAppVersion, 'sourceAppVersion');
    const dataSchemaVersion = normalizeNullableVersion(
      input.dataSchemaVersion,
      'dataSchemaVersion',
    );
    const wordStorageVersion = normalizeNullableVersion(
      input.wordStorageVersion,
      'wordStorageVersion',
    );
    const sensitiveKeyPresence = createSensitivePresence(
      sensitiveDefinitions,
      presentSensitiveKeys,
    );

    const snapshotPayload = createSnapshotDigestPayload({
      sourceAppVersion,
      dataSchemaVersion,
      wordStorageVersion,
      indexedDb,
      localStorage,
      selectedBackup: selectedBackup
        ? {
            sanitizedDigestSha256: selectedBackup.sanitizedDigestSha256,
            sanitizedText: selectedBackup.sanitizedText,
          }
        : null,
      canonicalManifestDigest: input.canonicalManifestDigest,
      sensitiveKeyPresence,
    });
    const sourceFingerprintPayload = createSourceFingerprintPayload({
      sourceAppVersion,
      dataSchemaVersion,
      wordStorageVersion,
      indexedDb,
      localStorage,
      selectedBackupFingerprintDigest: selectedBackup
        ? selectedBackup.containsSensitiveValue
          ? selectedBackup.sanitizedDigestSha256
          : selectedBackup.rawDigestSha256
        : null,
      canonicalManifestDigest: input.canonicalManifestDigest,
      sensitiveKeyPresence,
    });
    const [snapshotDigestSha256, sourceFingerprint] = await Promise.all([
      this.digestCanonical(snapshotPayload),
      this.digestCanonical(sourceFingerprintPayload),
    ]);

    return MigrationSourceSnapshotSchema.parse({
      schemaVersion: 1,
      snapshotKind: 'v1-source-snapshot',
      capturedAt: this.dependencies.now().toISOString(),
      sourceAppVersion,
      dataSchemaVersion,
      wordStorageVersion,
      indexedDb,
      localStorage,
      selectedBackup: selectedBackup
        ? {
            fileName: selectedBackup.fileName,
            fileSizeBytes: selectedBackup.fileSizeBytes,
            rawDigestSha256: selectedBackup.rawDigestSha256,
            sanitizedDigestSha256: selectedBackup.sanitizedDigestSha256,
            sanitizedText: selectedBackup.sanitizedText,
          }
        : null,
      canonicalManifestDigest: input.canonicalManifestDigest,
      sensitiveKeyPresence,
      sourceFingerprint,
      snapshotDigestSha256,
    });
  }

  private async prepareBackup(
    input: MigrationSelectedBackupInput | null,
    sensitiveKeys: ReadonlyMap<string, SensitiveKeyDefinition>,
    presentSensitiveKeys: Set<string>,
  ): Promise<PreparedBackup | null> {
    if (!input) {
      return null;
    }

    const actualFileSizeBytes = new TextEncoder().encode(input.text).byteLength;
    const fileSizeBytes = input.fileSizeBytes ?? actualFileSizeBytes;
    if (!Number.isInteger(fileSizeBytes) || fileSizeBytes < 0) {
      throw new MigrationSourceSnapshotInputError(
        'INVALID_METADATA',
        '备份文件大小必须是非负整数。',
      );
    }
    if (fileSizeBytes !== actualFileSizeBytes) {
      throw new MigrationSourceSnapshotInputError(
        'BACKUP_SIZE_MISMATCH',
        '备份文件大小与读取到的 UTF-8 字节数不一致。',
      );
    }
    if (fileSizeBytes > MAX_SOURCE_SNAPSHOT_BACKUP_BYTES) {
      throw new MigrationSourceSnapshotInputError(
        'BACKUP_TOO_LARGE',
        '备份文件超过 25 MB，无法安全创建来源快照。',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.text);
    } catch {
      throw new MigrationSourceSnapshotInputError(
        'INVALID_BACKUP_JSON',
        '选定备份不是有效 JSON，无法创建脱敏来源快照。',
      );
    }

    const backupPresentSensitiveKeys = new Set<string>();
    const redacted = this.redactValue(parsed, sensitiveKeys, backupPresentSensitiveKeys);
    for (const key of backupPresentSensitiveKeys) {
      presentSensitiveKeys.add(key);
    }
    const sanitizedText = JSON.stringify(redacted.value);
    if (!sanitizedText) {
      throw new MigrationSourceSnapshotInputError(
        'UNSERIALIZABLE_VALUE',
        '选定备份无法生成脱敏 JSON 快照。',
      );
    }

    return {
      fileName: normalizeSourceKey(input.fileName),
      fileSizeBytes,
      rawDigestSha256: await this.dependencies.digest.sha256(input.text),
      sanitizedDigestSha256: await this.dependencies.digest.sha256(sanitizedText),
      sanitizedText,
      containsSensitiveValue: backupPresentSensitiveKeys.size > 0,
    };
  }

  private redactValue(
    value: unknown,
    sensitiveKeys: ReadonlyMap<string, SensitiveKeyDefinition>,
    presentSensitiveKeys: Set<string>,
  ): RedactedValue {
    const redactedValue = canonicalizeValue(
      value,
      sensitiveKeys,
      presentSensitiveKeys,
      new WeakSet(),
    );
    return { value: redactedValue, presentSensitiveKeys };
  }

  private async digestCanonical(value: unknown): Promise<string> {
    return this.dependencies.digest.sha256(JSON.stringify(value));
  }
}
