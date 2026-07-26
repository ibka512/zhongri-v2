import type { TextDigestPort } from '../../ports';
import {
  MAX_MIGRATION_LEGACY_SOURCE_RECORDS,
  MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH,
  MigrationLegacySourceReaderInputSchema,
  MigrationLegacySourceSchema,
  migrationLegacySourceDomainOrder,
  type MigrationLegacySource,
  type MigrationLegacySourceReaderInput,
  type MigrationLegacySourceRecord,
} from '../../schemas/v1';
import type { MigrationPreviewDomain } from '../../schemas/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_SOURCE_DEPTH = 100;
const MAX_SOURCE_REF_LENGTH = 500;

const MODERN_TOP_LEVEL_KEYS = new Set([
  'format',
  'backupVersion',
  'schemaVersion',
  'appName',
  'kind',
  'exportDate',
  'data',
  'preferences',
]);

const MODERN_DATA_KEYS = new Set([
  'db',
  'userWords',
  'wordOverrides',
  'wordStorageVersion',
  'folders',
  'folderLangs',
  'stars',
  'records',
  'mtGroupClears',
  'mtWordClears',
  'aiConversations',
  'fsrsCards',
  'fsrsReviewLogs',
  'wrongBook',
  'aiQuizHistory',
  'recycleBin',
]);

const LEGACY_TOP_LEVEL_KEYS = new Set([
  'db',
  'folders',
  'folderLangs',
  'stars',
  'records',
  'mtGroupClears',
  'mtWordClears',
  'aiConversations',
  'preferences',
  'exportDate',
]);

const LEGACY_DATA_KEYS = new Set([
  'db',
  'folders',
  'folderLangs',
  'stars',
  'records',
  'mtGroupClears',
  'mtWordClears',
  'aiConversations',
]);

interface NormalizedBackup {
  sourceFormat: 'modern' | 'legacy-v4';
  backupVersion: number;
  dataSchemaVersion: number;
  wordStorageVersion: number | null;
  appName: string;
  kind: string;
  exportDate: string | null;
  data: Record<string, unknown>;
  preferences: unknown;
  unknownTopLevelKeys: string[];
  unknownDataKeys: string[];
}

interface DomainSourceDefinition {
  key: string;
  domain: MigrationPreviewDomain;
  kind: 'array' | 'object' | 'scalar';
}

const DOMAIN_SOURCE_DEFINITIONS: readonly DomainSourceDefinition[] = [
  { key: 'db', domain: 'words', kind: 'array' },
  { key: 'userWords', domain: 'words', kind: 'array' },
  { key: 'wordOverrides', domain: 'overrides', kind: 'object' },
  { key: 'folders', domain: 'folders', kind: 'array' },
  { key: 'folderLangs', domain: 'folders', kind: 'object' },
  { key: 'stars', domain: 'favorites', kind: 'array' },
  { key: 'records', domain: 'studyRecords', kind: 'array' },
  { key: 'mtWordClears', domain: 'mastery', kind: 'object' },
  { key: 'mtGroupClears', domain: 'groupProgress', kind: 'object' },
  { key: 'fsrsCards', domain: 'fsrsCards', kind: 'object' },
  { key: 'fsrsReviewLogs', domain: 'fsrsLogs', kind: 'array' },
  { key: 'wrongBook', domain: 'wrongBook', kind: 'object' },
  { key: 'aiConversations', domain: 'aiConversations', kind: 'array' },
  { key: 'aiQuizHistory', domain: 'aiQuizHistory', kind: 'array' },
  { key: 'recycleBin', domain: 'recycleBin', kind: 'array' },
];

export interface MigrationLegacySourceReaderDependencies {
  digest: TextDigestPort;
}

export class MigrationLegacySourceReaderInputError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'EMPTY_SOURCE'
      | 'FILE_TOO_LARGE'
      | 'INVALID_JSON'
      | 'UNKNOWN_FORMAT'
      | 'SENSITIVE_VALUE_PRESENT'
      | 'SOURCE_TOO_DEEPLY_NESTED'
      | 'SOURCE_REF_TOO_LONG'
      | 'UNSERIALIZABLE_SOURCE'
      | 'DIGEST_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationLegacySourceReaderInputError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeSensitiveKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveKey(value: string): boolean {
  return normalizeSensitiveKey(value) === 'deepseekapikey';
}

function toNonnegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toOptionalNonnegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function canonicalizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_SOURCE_DEPTH) {
    throw new MigrationLegacySourceReaderInputError(
      'SOURCE_TOO_DEEPLY_NESTED',
      '脱敏备份嵌套层级异常，无法安全读取。',
    );
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new MigrationLegacySourceReaderInputError(
        'UNSERIALIZABLE_SOURCE',
        '脱敏备份包含不可序列化的数字。',
      );
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item, depth + 1));
  }

  if (!isRecord(value)) {
    throw new MigrationLegacySourceReaderInputError(
      'UNSERIALIZABLE_SOURCE',
      '脱敏备份包含无法安全读取的值。',
    );
  }

  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value).sort(compareStrings)) {
    const nested = value[key];
    if (isSensitiveKey(key)) {
      if (nested !== '[REDACTED]') {
        throw new MigrationLegacySourceReaderInputError(
          'SENSITIVE_VALUE_PRESENT',
          '脱敏备份仍包含敏感 API Key 明文，读取已停止。',
        );
      }
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = canonicalizeValue(nested, depth + 1);
  }
  return result;
}

function serializeCanonicalValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined || serialized.length > MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH) {
    throw new MigrationLegacySourceReaderInputError(
      'UNSERIALIZABLE_SOURCE',
      '来源记录无法生成契约允许范围内的稳定 JSON。',
    );
  }
  return serialized;
}

function sourceValueType(value: unknown): MigrationLegacySourceRecord['sourceValueType'] {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  return 'number';
}

function ensureSourceRef(sourceRef: string): string {
  if (sourceRef.length > MAX_SOURCE_REF_LENGTH) {
    throw new MigrationLegacySourceReaderInputError(
      'SOURCE_REF_TOO_LONG',
      '来源键过长，无法在不截断审计引用的情况下读取。',
    );
  }
  return sourceRef;
}

function mapSourceRef(path: string, key: string): string {
  return ensureSourceRef(`${path}[${JSON.stringify(key)}]`);
}

function normalizeBackup(raw: Record<string, unknown>): NormalizedBackup {
  if (raw.format === 'zhongri-backup') {
    if (!isRecord(raw.data)) {
      throw new MigrationLegacySourceReaderInputError(
        'UNKNOWN_FORMAT',
        '现代备份缺少可读取的 data 数据区。',
      );
    }

    const data = raw.data;
    const backupVersion = toNonnegativeInteger(raw.backupVersion, 5);
    if (backupVersion < 5) {
      throw new MigrationLegacySourceReaderInputError(
        'UNKNOWN_FORMAT',
        '现代 zhongri-backup 必须是 v5 或更高版本。',
      );
    }

    return {
      sourceFormat: 'modern',
      backupVersion,
      dataSchemaVersion: toNonnegativeInteger(raw.schemaVersion, 1),
      wordStorageVersion: toOptionalNonnegativeInteger(data.wordStorageVersion),
      appName: typeof raw.appName === 'string' && raw.appName.trim() ? raw.appName.trim() : '钟日',
      kind: typeof raw.kind === 'string' && raw.kind.trim() ? raw.kind.trim() : 'manual',
      exportDate: normalizeDate(raw.exportDate),
      data,
      preferences: hasOwn(raw, 'preferences') ? raw.preferences : undefined,
      unknownTopLevelKeys: Object.keys(raw)
        .filter((key) => !MODERN_TOP_LEVEL_KEYS.has(key))
        .sort(compareStrings),
      unknownDataKeys: Object.keys(data)
        .filter(
          (key) =>
            !MODERN_DATA_KEYS.has(key) ||
            (key === 'wordStorageVersion' && toOptionalNonnegativeInteger(data[key]) === null),
        )
        .sort(compareStrings),
    };
  }

  if (Array.isArray(raw.db) && Array.isArray(raw.folders)) {
    const data: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of LEGACY_DATA_KEYS) {
      if (hasOwn(raw, key)) {
        data[key] = raw[key];
      }
    }

    return {
      sourceFormat: 'legacy-v4',
      backupVersion: 4,
      dataSchemaVersion: 0,
      wordStorageVersion: null,
      appName: '钟日',
      kind: 'legacy',
      exportDate: normalizeDate(raw.exportDate),
      data,
      preferences: hasOwn(raw, 'preferences') ? raw.preferences : undefined,
      unknownTopLevelKeys: Object.keys(raw)
        .filter((key) => !LEGACY_TOP_LEVEL_KEYS.has(key))
        .sort(compareStrings),
      unknownDataKeys: [],
    };
  }

  throw new MigrationLegacySourceReaderInputError(
    'UNKNOWN_FORMAT',
    '无法识别来源格式；当前只支持 zhongri-backup v5+ 和 legacy v4。',
  );
}

async function digestText(digest: TextDigestPort, text: string, label: string): Promise<string> {
  let result: string;
  try {
    result = await digest.sha256(text);
  } catch {
    throw new MigrationLegacySourceReaderInputError(
      'DIGEST_FAILED',
      `${label}摘要计算失败，读取已停止。`,
    );
  }

  if (!SHA256_PATTERN.test(result)) {
    throw new MigrationLegacySourceReaderInputError(
      'DIGEST_FAILED',
      `${label}摘要适配器返回了非法 SHA-256。`,
    );
  }
  return result;
}

function createCounts(records: readonly MigrationLegacySourceRecord[]) {
  return {
    source: records.length,
    byDomain: migrationLegacySourceDomainOrder.map((domain) => ({
      domain,
      count: records.filter((record) => record.domain === domain).length,
    })),
  };
}

export class MigrationLegacySourceReaderUseCase {
  constructor(private readonly dependencies: MigrationLegacySourceReaderDependencies) {}

  async read(input: MigrationLegacySourceReaderInput): Promise<MigrationLegacySource> {
    let parsedInput: MigrationLegacySourceReaderInput;
    try {
      parsedInput = MigrationLegacySourceReaderInputSchema.parse(input);
    } catch {
      throw new MigrationLegacySourceReaderInputError(
        'INVALID_INPUT',
        'legacy source reader 输入不符合契约。',
      );
    }

    if (!parsedInput.sanitizedSourceText.trim()) {
      throw new MigrationLegacySourceReaderInputError('EMPTY_SOURCE', '脱敏备份内容为空。');
    }

    if (parsedInput.sanitizedSourceText.length > MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH) {
      throw new MigrationLegacySourceReaderInputError(
        'FILE_TOO_LARGE',
        '脱敏备份超过 30 MB 读取上限。',
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(parsedInput.sanitizedSourceText);
    } catch {
      throw new MigrationLegacySourceReaderInputError(
        'INVALID_JSON',
        '脱敏备份不是可解析的 JSON。',
      );
    }

    const canonicalRoot = canonicalizeValue(parsedJson);
    if (!isRecord(canonicalRoot)) {
      throw new MigrationLegacySourceReaderInputError(
        'UNKNOWN_FORMAT',
        '来源 JSON 根节点必须是对象。',
      );
    }

    const backup = normalizeBackup(canonicalRoot);
    const canonicalSourceText = serializeCanonicalValue(canonicalRoot);
    const sourceTextDigestSha256 = await digestText(
      this.dependencies.digest,
      parsedInput.sanitizedSourceText,
      '来源文本',
    );
    const canonicalSourceDigestSha256 = await digestText(
      this.dependencies.digest,
      canonicalSourceText,
      '规范化来源',
    );

    const records: MigrationLegacySourceRecord[] = [];
    const addRecord = async (
      sourceRef: string,
      domain: MigrationPreviewDomain,
      value: unknown,
    ): Promise<void> => {
      if (records.length >= MAX_MIGRATION_LEGACY_SOURCE_RECORDS) {
        throw new MigrationLegacySourceReaderInputError(
          'FILE_TOO_LARGE',
          '来源记录数量超过读取上限。',
        );
      }

      const normalizedSourceRef = ensureSourceRef(sourceRef);
      const serializedValue = serializeCanonicalValue(value);
      const sourceRecordDigestSha256 = await digestText(
        this.dependencies.digest,
        JSON.stringify({
          schemaVersion: 1,
          sourceRef: normalizedSourceRef,
          domain,
          serializedValue,
        }),
        `来源记录 ${normalizedSourceRef}`,
      );
      records.push({
        schemaVersion: 1,
        sourceRef: normalizedSourceRef,
        domain,
        serializedValue,
        sourceValueType: sourceValueType(value),
        sourceRecordDigestSha256,
      });
    };

    for (const definition of DOMAIN_SOURCE_DEFINITIONS) {
      if (!hasOwn(backup.data, definition.key)) {
        continue;
      }

      const value = backup.data[definition.key];
      if (definition.kind === 'array' && Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
          await addRecord(`data.${definition.key}[${index}]`, definition.domain, item);
        }
        continue;
      }

      if (definition.kind === 'object' && isRecord(value)) {
        for (const key of Object.keys(value).sort(compareStrings)) {
          await addRecord(
            mapSourceRef(`data.${definition.key}`, key),
            definition.domain,
            value[key],
          );
        }
        continue;
      }

      await addRecord(`data.${definition.key}`, definition.domain, value);
    }

    if (backup.preferences !== undefined) {
      if (isRecord(backup.preferences)) {
        for (const key of Object.keys(backup.preferences).sort(compareStrings)) {
          await addRecord(mapSourceRef('preferences', key), 'preferences', backup.preferences[key]);
        }
      } else {
        await addRecord('preferences', 'preferences', backup.preferences);
      }
    }

    for (const key of backup.unknownTopLevelKeys) {
      await addRecord(mapSourceRef('topLevel', key), 'unknown', canonicalRoot[key]);
    }
    for (const key of backup.unknownDataKeys) {
      await addRecord(mapSourceRef('data', key), 'unknown', backup.data[key]);
    }

    records.sort((left, right) => compareStrings(left.sourceRef, right.sourceRef));
    const unknownSourceRefs = records
      .filter((record) => record.domain === 'unknown')
      .map((record) => record.sourceRef)
      .sort(compareStrings);
    const counts = createCounts(records);
    const readerDigestSha256 = await digestText(
      this.dependencies.digest,
      JSON.stringify({
        schemaVersion: 1,
        readerKind: 'v1-legacy-source',
        migrationId: parsedInput.migrationId,
        sourceFingerprint: parsedInput.sourceFingerprint,
        sourceFileName: parsedInput.sourceFileName.trim(),
        sourceFormat: backup.sourceFormat,
        backupVersion: backup.backupVersion,
        dataSchemaVersion: backup.dataSchemaVersion,
        wordStorageVersion: backup.wordStorageVersion,
        appName: backup.appName,
        kind: backup.kind,
        exportDate: backup.exportDate,
        canonicalSourceDigestSha256,
        records,
        unknownSourceRefs,
        counts,
      }),
      'legacy source reader',
    );

    return MigrationLegacySourceSchema.parse({
      schemaVersion: 1,
      readerKind: 'v1-legacy-source',
      migrationId: parsedInput.migrationId,
      sourceFingerprint: parsedInput.sourceFingerprint,
      sourceFileName: parsedInput.sourceFileName.trim(),
      sourceFormat: backup.sourceFormat,
      backupVersion: backup.backupVersion,
      dataSchemaVersion: backup.dataSchemaVersion,
      wordStorageVersion: backup.wordStorageVersion,
      appName: backup.appName,
      kind: backup.kind,
      exportDate: backup.exportDate,
      sourceTextDigestSha256,
      canonicalSourceDigestSha256,
      records,
      unknownSourceRefs,
      counts,
      readerDigestSha256,
    });
  }
}
