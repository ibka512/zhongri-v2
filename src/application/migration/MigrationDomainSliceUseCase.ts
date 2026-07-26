import type { CanonicalContentRepositoryPort, TextDigestPort } from '../../ports';
import { MigrationDispositionReportUseCase } from './MigrationDispositionReportUseCase';
import { MigrationIdentityMapUseCase } from './MigrationIdentityMapUseCase';
import {
  MigrationDomainSliceResultSchema,
  MigrationLegacySourceSchema,
  MigrationIsolatedFavoriteSchema,
  MigrationIsolatedFolderSchema,
  MigrationIsolatedOverrideSchema,
  MigrationIsolatedPayloadSchema,
  MigrationIsolatedWordSchema,
  type MigrationDispositionInputRecord,
  type MigrationDomainSliceResult,
  type MigrationIdentityMapEntry,
  type MigrationIdentityMapRecordInput,
  type MigrationIsolatedFavorite,
  type MigrationIsolatedFolder,
  type MigrationIsolatedOverride,
  type MigrationIsolatedWord,
  type MigrationLegacySource,
  type MigrationLegacySourceRecord,
} from '../../schemas/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface MigrationDomainSliceDependencies {
  content: CanonicalContentRepositoryPort;
  digest: TextDigestPort;
}

export interface CreateMigrationDomainSliceInput {
  source: MigrationLegacySource;
}

export class MigrationDomainSliceInputError extends Error {
  constructor(
    readonly code:
      'INVALID_INPUT' | 'INVALID_SOURCE_RECORD' | 'CANONICAL_TARGET_MISSING' | 'DIGEST_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationDomainSliceInputError';
  }
}

interface SourceValueRecord {
  record: MigrationLegacySourceRecord;
  value: unknown;
}

interface FolderLanguageRecord {
  record: MigrationLegacySourceRecord;
  language: 'ja' | 'en' | null;
}

interface FolderState {
  language: 'ja' | 'en';
  folderId: string;
  arrayRecord: MigrationLegacySourceRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.normalize('NFKC').trim();
  return normalized || null;
}

function languageValue(value: unknown): 'ja' | 'en' | null {
  const normalized = stringValue(value);
  return normalized === 'ja' || normalized === 'en' ? normalized : null;
}

function normalizedText(value: string | null): string | null {
  return (
    value
      ?.normalize('NFKC')
      .replace(/[\s\u3000]+/g, ' ')
      .trim()
      .toLowerCase() ?? null
  );
}

function readField(value: unknown, ...keys: readonly string[]): string | null {
  if (!isRecord(value)) {
    return null;
  }
  for (const key of keys) {
    const candidate = stringValue(value[key]);
    if (candidate) {
      return candidate;
    }
  }
  return null;
}

function readBooleanField(value: unknown, key: string): boolean | null {
  if (!isRecord(value) || typeof value[key] !== 'boolean') {
    return null;
  }
  return value[key] as boolean;
}

function parseSourceValue(record: MigrationLegacySourceRecord): unknown {
  try {
    return JSON.parse(record.serializedValue) as unknown;
  } catch {
    throw new MigrationDomainSliceInputError(
      'INVALID_SOURCE_RECORD',
      `来源记录 ${record.sourceRef} 的 serializedValue 无法解析。`,
    );
  }
}

function readSourceKey(sourceRef: string, prefix: string): string | null {
  if (!sourceRef.startsWith(`${prefix}[`) || !sourceRef.endsWith(']')) {
    return null;
  }
  const serializedKey = sourceRef.slice(prefix.length + 1, -1);
  try {
    return stringValue(JSON.parse(serializedKey) as unknown);
  } catch {
    return null;
  }
}

function sourceValueRecords(
  source: MigrationLegacySource,
  domain: MigrationLegacySourceRecord['domain'],
): SourceValueRecord[] {
  return source.records
    .filter((record) => record.domain === domain)
    .map((record) => ({ record, value: parseSourceValue(record) }));
}

function createIdentityInput(
  record: MigrationLegacySourceRecord,
  value: unknown,
): MigrationIdentityMapRecordInput {
  const isWord = record.domain === 'words';
  const sourceIsBuiltIn = record.sourceRef.startsWith('data.db[');
  if (isWord) {
    const language = languageValue(isRecord(value) ? (value.lang ?? value.language) : undefined);
    return {
      sourceRef: record.sourceRef,
      sourceKind: 'word',
      language,
      wordId: readField(value, '_id', 'id'),
      headword: readField(value, 'word', 'headword', 'term'),
      reading: readField(value, 'kana', 'reading'),
      isBuiltIn: readBooleanField(value, 'isBuiltIn') ?? sourceIsBuiltIn,
      rawRecordDigestSha256: record.sourceRecordDigestSha256,
    };
  }

  const wordId = readSourceKey(record.sourceRef, 'data.wordOverrides');
  const language = languageValue(isRecord(value) ? (value.lang ?? value.language) : undefined);
  return {
    sourceRef: record.sourceRef,
    sourceKind: 'override-reference',
    language,
    wordId,
    headword: readField(value, 'word', 'headword', 'term'),
    reading: readField(value, 'kana', 'reading'),
    rawRecordDigestSha256: record.sourceRecordDigestSha256,
  };
}

function createQuarantineDisposition(
  record: MigrationLegacySourceRecord,
  reasonCode: string,
  quarantineCode: string,
  severity: 'warning' | 'blocking' = 'blocking',
): MigrationDispositionInputRecord {
  return {
    sourceRef: record.sourceRef,
    domain: record.domain,
    sourceRecordDigestSha256: record.sourceRecordDigestSha256,
    outcome: 'quarantined',
    severity,
    reasonCode,
    quarantineCode,
  };
}

function createMigratedDisposition(
  record: MigrationLegacySourceRecord,
  domain: MigrationDispositionInputRecord['domain'],
  reasonCode: string,
  targetRef: string,
): MigrationDispositionInputRecord {
  return {
    sourceRef: record.sourceRef,
    domain,
    sourceRecordDigestSha256: record.sourceRecordDigestSha256,
    outcome: 'migrated',
    severity: 'info',
    reasonCode,
    targetRefs: [targetRef],
    rawArchive: true,
  };
}

function createDedupedDisposition(
  record: MigrationLegacySourceRecord,
  domain: MigrationDispositionInputRecord['domain'],
  reasonCode: string,
  targetRef: string,
  canonicalSourceRef: string,
): MigrationDispositionInputRecord {
  return {
    sourceRef: record.sourceRef,
    domain,
    sourceRecordDigestSha256: record.sourceRecordDigestSha256,
    outcome: 'deduped',
    severity: 'warning',
    reasonCode,
    targetRefs: [targetRef],
    canonicalSourceRef,
    rawArchive: true,
  };
}

function readWordEntryForSource(
  entryBySourceRef: ReadonlyMap<string, MigrationIdentityMapEntry>,
  sourceRef: string,
): MigrationIdentityMapEntry | null {
  return entryBySourceRef.get(sourceRef) ?? null;
}

function findCanonicalWord(
  dependencies: MigrationDomainSliceDependencies,
  entry: MigrationIdentityMapEntry,
) {
  if (entry.targetKind !== 'canonical' || !entry.targetWordId) {
    return null;
  }
  return dependencies.content.findById(entry.language, entry.targetWordId);
}

function assertDigest(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new MigrationDomainSliceInputError(
      'DIGEST_FAILED',
      `${label}没有返回合法的 SHA-256 摘要。`,
    );
  }
}

export class MigrationDomainSliceUseCase {
  constructor(private readonly dependencies: MigrationDomainSliceDependencies) {}

  async create(input: CreateMigrationDomainSliceInput): Promise<MigrationDomainSliceResult> {
    let source: MigrationLegacySource;
    try {
      source = MigrationLegacySourceSchema.parse(input.source);
    } catch {
      throw new MigrationDomainSliceInputError(
        'INVALID_INPUT',
        'Legacy Source Reader 输出不符合契约。',
      );
    }

    const wordRecords = sourceValueRecords(source, 'words');
    const overrideRecords = sourceValueRecords(source, 'overrides');
    const folderRecords = sourceValueRecords(source, 'folders');
    const favoriteRecords = sourceValueRecords(source, 'favorites');
    const identityMap = await new MigrationIdentityMapUseCase({
      content: this.dependencies.content,
      digest: this.dependencies.digest,
    }).create({
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      records: [...wordRecords, ...overrideRecords].map(({ record, value }) =>
        createIdentityInput(record, value),
      ),
    });
    const entryBySourceRef = new Map(identityMap.entries.map((entry) => [entry.sourceRef, entry]));
    const dispositionRecords: MigrationDispositionInputRecord[] = [];

    const wordPayloadByTargetId = new Map<string, MigrationIsolatedWord>();
    const wordOwnerByTargetId = new Map<string, string>();
    const wordEntryByRawId = new Map<string, MigrationIdentityMapEntry[]>();
    const wordEntriesByHeadword = new Map<string, MigrationIdentityMapEntry[]>();

    for (const { record, value } of wordRecords) {
      const entry = readWordEntryForSource(entryBySourceRef, record.sourceRef);
      const rawWordId = readField(value, '_id', 'id');
      const rawHeadword = readField(value, 'word', 'headword', 'term');
      if (entry?.rawWordId) {
        const entries = wordEntryByRawId.get(entry.rawWordId) ?? [];
        entries.push(entry);
        wordEntryByRawId.set(entry.rawWordId, entries);
      } else if (rawWordId) {
        const entries = wordEntryByRawId.get(rawWordId) ?? [];
        if (entry) {
          entries.push(entry);
          wordEntryByRawId.set(rawWordId, entries);
        }
      }
      const normalizedHeadword = normalizedText(entry?.rawHeadword ?? rawHeadword);
      if (normalizedHeadword && entry) {
        const entries = wordEntriesByHeadword.get(normalizedHeadword) ?? [];
        entries.push(entry);
        wordEntriesByHeadword.set(normalizedHeadword, entries);
      }

      if (!entry || entry.outcome === 'quarantined') {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            'WORD_IDENTITY_QUARANTINED',
            entry?.quarantineCode ?? 'RELATION_UNRESOLVED',
          ),
        );
        continue;
      }
      if (!entry.targetWordId || !entry.targetKind) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'WORD_TARGET_MISSING', 'RELATION_UNRESOLVED'),
        );
        continue;
      }

      const canonicalWord = findCanonicalWord(this.dependencies, entry);
      if (entry.targetKind === 'canonical' && !canonicalWord) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'CANONICAL_TARGET_MISSING', 'CANONICAL_NOT_FOUND'),
        );
        continue;
      }
      const headword = canonicalWord?.headword ?? rawHeadword;
      if (!headword) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'WORD_PAYLOAD_INVALID', 'EMPTY_IDENTITY'),
        );
        continue;
      }
      const payload = MigrationIsolatedWordSchema.parse({
        schemaVersion: 1,
        targetWordId: entry.targetWordId,
        targetKind: entry.targetKind,
        language: entry.language,
        headword,
        reading: canonicalWord?.reading ?? readField(value, 'kana', 'reading'),
        meaning: canonicalWord?.meaning ?? readField(value, 'meaning', 'gloss'),
        sourceRefs: [record.sourceRef],
        sourceRecordDigestsSha256: [record.sourceRecordDigestSha256],
      });
      const owner = wordOwnerByTargetId.get(entry.targetWordId);
      if (owner) {
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'words',
            'DUPLICATE_WORD_TARGET',
            entry.targetWordId,
            owner,
          ),
        );
        continue;
      }
      wordOwnerByTargetId.set(entry.targetWordId, record.sourceRef);
      wordPayloadByTargetId.set(entry.targetWordId, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'words', 'WORD_MAPPED', entry.targetWordId),
      );
    }

    const overridePayloadByTargetId = new Map<string, MigrationIsolatedOverride>();
    for (const { record } of overrideRecords) {
      const entry = entryBySourceRef.get(record.sourceRef);
      if (!entry || entry.outcome === 'quarantined') {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            'OVERRIDE_IDENTITY_QUARANTINED',
            entry?.quarantineCode ?? 'OVERRIDE_ORPHAN',
          ),
        );
        continue;
      }
      if (!entry.targetWordId) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'OVERRIDE_TARGET_MISSING', 'OVERRIDE_ORPHAN'),
        );
        continue;
      }
      const targetExists =
        wordPayloadByTargetId.has(entry.targetWordId) ||
        findCanonicalWord(this.dependencies, entry) !== null;
      if (!targetExists) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'OVERRIDE_TARGET_MISSING', 'OVERRIDE_ORPHAN'),
        );
        continue;
      }
      const existing = overridePayloadByTargetId.get(entry.targetWordId);
      if (existing) {
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'overrides',
            'DUPLICATE_OVERRIDE_TARGET',
            entry.targetWordId,
            existing.sourceRef,
          ),
        );
        continue;
      }
      const payload = MigrationIsolatedOverrideSchema.parse({
        schemaVersion: 1,
        targetWordId: entry.targetWordId,
        language: entry.language,
        sourceRef: record.sourceRef,
        sourceRecordDigestSha256: record.sourceRecordDigestSha256,
        serializedValue: record.serializedValue,
      });
      overridePayloadByTargetId.set(entry.targetWordId, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'overrides', 'OVERRIDE_MAPPED', entry.targetWordId),
      );
    }

    const folderArrayRecords = folderRecords.filter(({ record }) =>
      record.sourceRef.startsWith('data.folders['),
    );
    const folderLanguageRecords = folderRecords.filter(({ record }) =>
      record.sourceRef.startsWith('data.folderLangs['),
    );
    const folderLanguages = new Map<string, FolderLanguageRecord>();
    for (const { record, value } of folderLanguageRecords) {
      const name = readSourceKey(record.sourceRef, 'data.folderLangs');
      folderLanguages.set(name ?? record.sourceRef, {
        record,
        language: languageValue(value),
      });
    }

    const folderByName = new Map<string, FolderState>();
    const folderPayloadById = new Map<string, MigrationIsolatedFolder>();
    for (const { record, value } of folderArrayRecords) {
      const name = stringValue(value);
      const normalizedName = normalizedText(name);
      const languageRecord = name ? folderLanguages.get(name) : undefined;
      if (!name || !normalizedName || !languageRecord?.language) {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            !name || !normalizedName ? 'FOLDER_INVALID' : 'FOLDER_LANGUAGE_MISSING',
            'RELATION_UNRESOLVED',
            'warning',
          ),
        );
        continue;
      }
      const folderDigest = await this.dependencies.digest.sha256(
        JSON.stringify({
          schemaVersion: 1,
          migrationId: source.migrationId,
          name: normalizedName,
          language: languageRecord.language,
        }),
      );
      assertDigest(folderDigest, 'folder ID');
      const folderId = `folder-v1-${folderDigest.slice(0, 24)}`;
      const existing = folderByName.get(normalizedName);
      if (existing) {
        if (existing.language === languageRecord.language) {
          dispositionRecords.push(
            createDedupedDisposition(
              record,
              'folders',
              'DUPLICATE_FOLDER',
              existing.folderId,
              existing.arrayRecord.sourceRef,
            ),
          );
        } else {
          dispositionRecords.push(
            createQuarantineDisposition(record, 'FOLDER_LANGUAGE_CONFLICT', 'RELATION_UNRESOLVED'),
          );
        }
        continue;
      }
      const payload = MigrationIsolatedFolderSchema.parse({
        schemaVersion: 1,
        folderId,
        name,
        language: languageRecord.language,
        sourceRefs: [record.sourceRef, languageRecord.record.sourceRef],
        sourceRecordDigestsSha256: [
          record.sourceRecordDigestSha256,
          languageRecord.record.sourceRecordDigestSha256,
        ],
      });
      folderByName.set(normalizedName, {
        language: languageRecord.language,
        folderId,
        arrayRecord: record,
      });
      folderPayloadById.set(folderId, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'folders', 'FOLDER_MAPPED', folderId),
      );
    }

    for (const { record, value } of folderLanguageRecords) {
      const name = readSourceKey(record.sourceRef, 'data.folderLangs');
      const folder = name ? folderByName.get(normalizedText(name) ?? '') : undefined;
      const language = languageValue(value);
      if (!folder || !language) {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            !name ? 'FOLDER_LANGUAGE_KEY_INVALID' : 'FOLDER_ORPHAN_LANGUAGE',
            'RELATION_UNRESOLVED',
            'warning',
          ),
        );
        continue;
      }
      if (folder.language !== language) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'FOLDER_LANGUAGE_CONFLICT', 'RELATION_UNRESOLVED'),
        );
        continue;
      }
      dispositionRecords.push(
        createMigratedDisposition(record, 'folders', 'FOLDER_LANGUAGE_MAPPED', folder.folderId),
      );
    }

    const favoritePayloadByTargetId = new Map<string, MigrationIsolatedFavorite>();
    for (const { record, value } of favoriteRecords) {
      const favoriteRef = stringValue(value);
      const normalizedFavoriteRef = favoriteRef?.replace(/^(ja|en):/, '') ?? null;
      const rawCandidates = normalizedFavoriteRef
        ? (wordEntryByRawId.get(normalizedFavoriteRef) ?? [])
        : [];
      const headwordCandidates =
        rawCandidates.length === 0 && normalizedFavoriteRef
          ? (wordEntriesByHeadword.get(normalizedText(normalizedFavoriteRef) ?? '') ?? [])
          : [];
      const candidates = [...rawCandidates, ...headwordCandidates];
      const uniqueTargets = new Map(
        candidates
          .filter((entry) => entry.outcome === 'mapped' && entry.targetWordId)
          .map((entry) => [entry.targetWordId as string, entry]),
      );
      if (uniqueTargets.size !== 1) {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            'FAVORITE_TARGET_UNRESOLVED',
            'RELATION_UNRESOLVED',
            'warning',
          ),
        );
        continue;
      }
      const [targetWordId] = uniqueTargets.keys();
      const existing = favoritePayloadByTargetId.get(targetWordId);
      if (existing) {
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'favorites',
            'DUPLICATE_FAVORITE',
            targetWordId,
            existing.sourceRef,
          ),
        );
        continue;
      }
      const payload = MigrationIsolatedFavoriteSchema.parse({
        schemaVersion: 1,
        targetWordId,
        sourceRef: record.sourceRef,
        sourceRecordDigestSha256: record.sourceRecordDigestSha256,
      });
      favoritePayloadByTargetId.set(targetWordId, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'favorites', 'FAVORITE_MAPPED', targetWordId),
      );
    }

    const dispositionReport = await new MigrationDispositionReportUseCase({
      digest: this.dependencies.digest,
    }).create({
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      identityMapDigestSha256: identityMap.mapDigestSha256,
      records: dispositionRecords,
    });

    const payloadFields = {
      schemaVersion: 1 as const,
      stagingKind: 'migration-isolated-domain-slice' as const,
      datasetId: `dataset:${source.migrationId}`,
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      sourceReaderDigestSha256: source.readerDigestSha256,
      identityMapDigestSha256: identityMap.mapDigestSha256,
      dispositionReportDigestSha256: dispositionReport.reportDigestSha256,
      words: [...wordPayloadByTargetId.values()].sort((left, right) =>
        compareStrings(left.targetWordId, right.targetWordId),
      ),
      overrides: [...overridePayloadByTargetId.values()].sort((left, right) =>
        compareStrings(left.sourceRef, right.sourceRef),
      ),
      folders: [...folderPayloadById.values()].sort((left, right) =>
        compareStrings(left.folderId, right.folderId),
      ),
      favorites: [...favoritePayloadByTargetId.values()].sort((left, right) =>
        compareStrings(left.targetWordId, right.targetWordId),
      ),
      writesPerformed: false as const,
      activePointerUpdated: false as const,
    };
    const payloadDigestSha256 = await this.dependencies.digest.sha256(
      JSON.stringify(payloadFields),
    );
    assertDigest(payloadDigestSha256, 'isolated domain payload');
    const isolatedPayload = MigrationIsolatedPayloadSchema.parse({
      ...payloadFields,
      payloadDigestSha256,
    });

    return MigrationDomainSliceResultSchema.parse({
      schemaVersion: 1,
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      identityMap,
      dispositionReport,
      isolatedPayload,
    });
  }
}
