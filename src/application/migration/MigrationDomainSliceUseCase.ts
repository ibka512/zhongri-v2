import type { CanonicalContentRepositoryPort, TextDigestPort } from '../../ports';
import { MigrationDispositionReportUseCase } from './MigrationDispositionReportUseCase';
import { MigrationIdentityMapUseCase } from './MigrationIdentityMapUseCase';
import {
  MigrationDomainSliceResultSchema,
  MigrationLegacySourceSchema,
  MigrationIsolatedFavoriteSchema,
  MigrationIsolatedFsrsCardSchema,
  MigrationIsolatedFsrsLogSchema,
  MigrationIsolatedFolderSchema,
  MigrationIsolatedMasterySchema,
  MigrationIsolatedOverrideSchema,
  MigrationIsolatedPayloadSchema,
  MigrationIsolatedStudyRecordSchema,
  MigrationIsolatedWordSchema,
  type MigrationDispositionInputRecord,
  type MigrationDomainSliceResult,
  type MigrationIdentityMapEntry,
  type MigrationIdentityMapRecordInput,
  type MigrationIsolatedFavorite,
  type MigrationIsolatedFsrsCard,
  type MigrationIsolatedFsrsLog,
  type MigrationIsolatedFolder,
  type MigrationIsolatedMastery,
  type MigrationIsolatedOverride,
  type MigrationIsolatedWord,
  type MigrationIsolatedStudyRecord,
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

type ReviewDimension = 'spelling' | 'reading' | 'listening' | 'meaning';

interface WordRelation {
  language: 'ja' | 'en' | null;
  rawWordId: string | null;
  dimension: ReviewDimension | null;
  rawKey: string | null;
}

interface ParsedNumber {
  value: number;
  present: boolean;
}

interface ParsedDate {
  value: string | null;
  present: boolean;
  valid: boolean;
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

function readNumberField(value: unknown, ...keys: readonly string[]): ParsedNumber {
  if (!isRecord(value)) {
    return { value: 0, present: false };
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return typeof value[key] === 'number' && Number.isFinite(value[key])
        ? { value: value[key] as number, present: true }
        : { value: Number.NaN, present: true };
    }
  }
  return { value: 0, present: false };
}

function readDateField(value: unknown, ...keys: readonly string[]): ParsedDate {
  if (!isRecord(value)) {
    return { value: null, present: false, valid: false };
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }
    const raw = value[key];
    if (raw === null || raw === '') {
      return { value: null, present: true, valid: true };
    }
    if (typeof raw !== 'string') {
      return { value: null, present: true, valid: false };
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? { value: null, present: true, valid: false }
      : { value: parsed.toISOString(), present: true, valid: true };
  }
  return { value: null, present: false, valid: false };
}

function readDateOnly(value: unknown): {
  value: string | null;
  flag: 'DATE_MISSING' | 'DATE_INVALID' | null;
} {
  const raw = stringValue(value);
  if (!raw) {
    return { value: null, flag: 'DATE_MISSING' };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { value: raw, flag: null };
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, flag: 'DATE_INVALID' };
  }
  return { value: parsed.toISOString().slice(0, 10), flag: 'DATE_INVALID' };
}

function normalizeReviewDimension(
  language: 'ja' | 'en' | null,
  value: unknown,
): ReviewDimension | null {
  const normalized = stringValue(value)?.toLowerCase() ?? null;
  if (!normalized) {
    return null;
  }
  if (normalized === 'meaning') {
    return 'meaning';
  }
  if (language === 'ja') {
    if (normalized === 'kanji' || normalized === 'spelling') {
      return 'spelling';
    }
    if (normalized === 'kana' || normalized === 'reading') {
      return 'reading';
    }
  }
  if (language === 'en') {
    if (normalized === 'kanji' || normalized === 'word' || normalized === 'spelling') {
      return 'spelling';
    }
    if (normalized === 'kana' || normalized === 'listening') {
      return 'listening';
    }
  }
  return null;
}

function parseWordRelationKey(rawKey: string | null): WordRelation {
  if (!rawKey) {
    return { language: null, rawWordId: null, dimension: null, rawKey: null };
  }
  const parts = rawKey.split(':');
  if (parts.length < 2) {
    return { language: null, rawWordId: null, dimension: null, rawKey };
  }
  const language = languageValue(parts[0]);
  const rawWordId =
    stringValue(
      parts.length === 2 ? parts.slice(1).join(':') : parts.slice(1, parts.length - 1).join(':'),
    ) ?? null;
  const dimension = parts.length >= 3 ? normalizeReviewDimension(language, parts.at(-1)) : null;
  return { language, rawWordId, dimension, rawKey };
}

function resolveRelationFromValue(value: unknown, rawKey: string | null): WordRelation {
  const parsedKey = parseWordRelationKey(rawKey);
  const language =
    languageValue(isRecord(value) ? (value.lang ?? value.language) : undefined) ??
    parsedKey.language;
  const rawWordId = readField(value, 'wordId', 'wordID', 'word_id', 'id') ?? parsedKey.rawWordId;
  const dimension =
    normalizeReviewDimension(language, isRecord(value) ? value.dimension : undefined) ??
    parsedKey.dimension;
  return {
    language,
    rawWordId,
    dimension,
    rawKey: rawKey ?? (isRecord(value) ? readField(value, 'key', 'cardKey', 'rawKey') : null),
  };
}

function relationKey(
  language: 'ja' | 'en',
  targetWordId: string,
  dimension: ReviewDimension,
): string {
  return `${language}:${targetWordId}:${dimension}`;
}

function masteryDimensions(value: unknown, language: 'ja' | 'en') {
  const spelling =
    readBooleanField(value, 'kanji') ??
    (language === 'en' ? readBooleanField(value, 'word') : null);
  const reading = language === 'ja' ? readBooleanField(value, 'kana') : null;
  const listening = language === 'en' ? readBooleanField(value, 'kana') : null;
  const meaning = readBooleanField(value, 'meaning');
  const needsReview = readBooleanField(value, 'needsReview');
  return {
    dimensions: {
      spelling: spelling ?? false,
      reading: reading ?? false,
      listening: listening ?? false,
      meaning: meaning ?? false,
    },
    needsReview: needsReview ?? false,
    missingFields: [
      spelling === null ? 'spelling' : null,
      reading === null ? 'reading' : null,
      listening === null ? 'listening' : null,
      meaning === null ? 'meaning' : null,
      needsReview === null ? 'needsReview' : null,
    ].filter(
      (field): field is 'spelling' | 'reading' | 'listening' | 'meaning' | 'needsReview' =>
        field !== null,
    ),
  };
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
  severity: 'info' | 'warning' | 'blocking' = 'info',
): MigrationDispositionInputRecord {
  return {
    sourceRef: record.sourceRef,
    domain,
    sourceRecordDigestSha256: record.sourceRecordDigestSha256,
    outcome: 'migrated',
    severity,
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

function resolveWordRelation(
  wordEntryByRawId: ReadonlyMap<string, MigrationIdentityMapEntry[]>,
  wordEntriesByHeadword: ReadonlyMap<string, MigrationIdentityMapEntry[]>,
  relation: WordRelation,
): MigrationIdentityMapEntry | null {
  if (!relation.rawWordId || !relation.language) {
    return null;
  }
  const rawCandidates = wordEntryByRawId.get(relation.rawWordId) ?? [];
  const candidates = (
    rawCandidates.length > 0
      ? rawCandidates
      : (wordEntriesByHeadword.get(normalizedText(relation.rawWordId) ?? '') ?? [])
  ).filter((entry) => entry.language === relation.language && entry.outcome === 'mapped');
  const uniqueTargets = new Map(
    candidates
      .filter((entry) => entry.targetWordId)
      .map((entry) => [entry.targetWordId as string, entry]),
  );
  return uniqueTargets.size === 1 ? [...uniqueTargets.values()][0] : null;
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

    const masteryPayloadByTargetId = new Map<string, MigrationIsolatedMastery>();
    for (const { record, value } of sourceValueRecords(source, 'mastery')) {
      const sourceKey = readSourceKey(record.sourceRef, 'data.mtWordClears');
      const relation = resolveRelationFromValue(value, sourceKey);
      const entry = resolveWordRelation(wordEntryByRawId, wordEntriesByHeadword, relation);
      if (!entry || !entry.targetWordId || !relation.language || !isRecord(value)) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'MASTERY_TARGET_UNRESOLVED', 'RELATION_UNRESOLVED'),
        );
        continue;
      }

      const projection = masteryDimensions(value, relation.language);
      const existing = masteryPayloadByTargetId.get(entry.targetWordId);
      if (existing) {
        const allFields = ['spelling', 'reading', 'listening', 'meaning', 'needsReview'] as const;
        const existingMissing = new Set(existing.missingFields);
        const currentMissing = new Set(projection.missingFields);
        const mergedMissingFields = allFields.filter(
          (field) => existingMissing.has(field) && currentMissing.has(field),
        );
        const merged = MigrationIsolatedMasterySchema.parse({
          ...existing,
          dimensions: {
            spelling: existing.dimensions.spelling || projection.dimensions.spelling,
            reading: existing.dimensions.reading || projection.dimensions.reading,
            listening: existing.dimensions.listening || projection.dimensions.listening,
            meaning: existing.dimensions.meaning || projection.dimensions.meaning,
          },
          needsReview: existing.needsReview || projection.needsReview,
          missingFields: mergedMissingFields,
          sourceRefs: [...new Set([...existing.sourceRefs, record.sourceRef])].sort(compareStrings),
          sourceRecordDigestsSha256: [
            ...new Set([...existing.sourceRecordDigestsSha256, record.sourceRecordDigestSha256]),
          ].sort(compareStrings),
          serializedValues: [
            ...new Set([...existing.serializedValues, record.serializedValue]),
          ].sort(compareStrings),
        });
        masteryPayloadByTargetId.set(entry.targetWordId, merged);
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'mastery',
            'DUPLICATE_MASTERY_TARGET',
            entry.targetWordId,
            existing.sourceRefs[0],
          ),
        );
        continue;
      }

      const payload = MigrationIsolatedMasterySchema.parse({
        schemaVersion: 1,
        targetWordId: entry.targetWordId,
        language: relation.language,
        sourceRefs: [record.sourceRef],
        sourceRecordDigestsSha256: [record.sourceRecordDigestSha256],
        ...projection,
        serializedValues: [record.serializedValue],
      });
      masteryPayloadByTargetId.set(entry.targetWordId, payload);
      dispositionRecords.push(
        createMigratedDisposition(
          record,
          'mastery',
          'MASTERY_MAPPED',
          `mastery-v1:${entry.targetWordId}`,
        ),
      );
    }

    const studyPayloadByFingerprint = new Map<string, MigrationIsolatedStudyRecord>();
    for (const { record, value } of sourceValueRecords(source, 'studyRecords')) {
      if (!isRecord(value)) {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            'STUDY_RECORD_INVALID',
            'RELATION_UNRESOLVED',
            'warning',
          ),
        );
        continue;
      }
      const rawType = stringValue(value.type)?.toLowerCase() ?? null;
      const eventType =
        rawType === 'daily_punch'
          ? 'DAILY_PUNCH'
          : rawType === 'pendulum'
            ? 'GROUP_COMPLETED'
            : 'UNKNOWN';
      const dateProjection = readDateOnly(value.date);
      const groupLabel = readField(value, 'group', 'groupLabel');
      const qualityFlags = [
        dateProjection.flag,
        eventType === 'UNKNOWN' ? 'UNKNOWN_TYPE' : null,
      ].filter((flag): flag is 'DATE_MISSING' | 'DATE_INVALID' | 'UNKNOWN_TYPE' => flag !== null);
      const fingerprint = await this.dependencies.digest.sha256(
        JSON.stringify({
          schemaVersion: 1,
          migrationId: source.migrationId,
          eventType,
          dateOnly: dateProjection.value,
          groupLabel,
        }),
      );
      assertDigest(fingerprint, 'study event ID');
      const existing = studyPayloadByFingerprint.get(fingerprint);
      if (existing) {
        studyPayloadByFingerprint.set(
          fingerprint,
          MigrationIsolatedStudyRecordSchema.parse({
            ...existing,
            sourceRefs: [...new Set([...existing.sourceRefs, record.sourceRef])].sort(
              compareStrings,
            ),
            sourceRecordDigestsSha256: [
              ...new Set([...existing.sourceRecordDigestsSha256, record.sourceRecordDigestSha256]),
            ].sort(compareStrings),
            qualityFlags: [...new Set([...existing.qualityFlags, ...qualityFlags])].sort(
              compareStrings,
            ),
            serializedValues: [
              ...new Set([...existing.serializedValues, record.serializedValue]),
            ].sort(compareStrings),
          }),
        );
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'studyRecords',
            'DUPLICATE_STUDY_EVENT',
            existing.eventId,
            existing.sourceRefs[0],
          ),
        );
        continue;
      }
      const eventId = `study-event-v1:${fingerprint.slice(0, 24)}`;
      const payload = MigrationIsolatedStudyRecordSchema.parse({
        schemaVersion: 1,
        eventId,
        eventType,
        dateOnly: dateProjection.value,
        rawDate: stringValue(value.date),
        groupLabel,
        sourceRefs: [record.sourceRef],
        sourceRecordDigestsSha256: [record.sourceRecordDigestSha256],
        qualityFlags,
        serializedValues: [record.serializedValue],
      });
      studyPayloadByFingerprint.set(fingerprint, payload);
      dispositionRecords.push(
        createMigratedDisposition(
          record,
          'studyRecords',
          eventType === 'UNKNOWN' ? 'STUDY_EVENT_UNKNOWN' : 'STUDY_EVENT_MAPPED',
          eventId,
          eventType === 'UNKNOWN' || qualityFlags.length > 0 ? 'warning' : 'info',
        ),
      );
    }

    const fsrsCardPayloadByRelation = new Map<string, MigrationIsolatedFsrsCard>();
    for (const { record, value } of sourceValueRecords(source, 'fsrsCards')) {
      const rawKey = readSourceKey(record.sourceRef, 'data.fsrsCards');
      const relation = resolveRelationFromValue(value, rawKey);
      const entry = resolveWordRelation(wordEntryByRawId, wordEntriesByHeadword, relation);
      const cardValue = isRecord(value) ? value : null;
      if (
        !entry ||
        !entry.targetWordId ||
        !relation.language ||
        !relation.dimension ||
        !relation.rawKey ||
        !cardValue
      ) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'FSRS_CARD_RELATION_INVALID', 'RELATION_UNRESOLVED'),
        );
        continue;
      }

      const due = readDateField(cardValue, 'due');
      const lastReviewedAt = readDateField(cardValue, 'last_review', 'lastReviewedAt');
      const stability = readNumberField(cardValue, 'stability');
      const difficulty = readNumberField(cardValue, 'difficulty');
      const elapsedDays = readNumberField(cardValue, 'elapsed_days', 'elapsedDays');
      const scheduledDays = readNumberField(cardValue, 'scheduled_days', 'scheduledDays');
      const reps = readNumberField(cardValue, 'reps');
      const lapses = readNumberField(cardValue, 'lapses');
      const learningSteps = readNumberField(cardValue, 'learning_steps', 'learningSteps');
      const state = readNumberField(cardValue, 'state');
      const requiredNumberInvalid = (field: ParsedNumber, nonnegative = true) =>
        !field.present || !Number.isFinite(field.value) || (nonnegative && field.value < 0);
      const integerNumberInvalid = (field: ParsedNumber) =>
        field.present &&
        (!Number.isFinite(field.value) || !Number.isInteger(field.value) || field.value < 0);
      if (
        !due.present ||
        !due.valid ||
        !due.value ||
        requiredNumberInvalid(stability) ||
        requiredNumberInvalid(difficulty, false) ||
        integerNumberInvalid(elapsedDays) ||
        integerNumberInvalid(scheduledDays) ||
        integerNumberInvalid(reps) ||
        integerNumberInvalid(lapses) ||
        integerNumberInvalid(learningSteps) ||
        integerNumberInvalid(state) ||
        (lastReviewedAt.present && !lastReviewedAt.valid)
      ) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'FSRS_CARD_INVALID', 'CORRUPT_V1_RECORD'),
        );
        continue;
      }

      const qualityFlags = [
        !elapsedDays.present ? 'ELAPSED_DAYS_DEFAULTED' : null,
        !scheduledDays.present ? 'SCHEDULED_DAYS_DEFAULTED' : null,
        !reps.present ? 'REPS_DEFAULTED' : null,
        !lapses.present ? 'LAPSES_DEFAULTED' : null,
        !learningSteps.present ? 'LEARNING_STEPS_DEFAULTED' : null,
        !state.present ? 'STATE_DEFAULTED' : null,
        !lastReviewedAt.present ? 'LAST_REVIEW_MISSING' : null,
      ].filter(
        (
          flag,
        ): flag is
          | 'ELAPSED_DAYS_DEFAULTED'
          | 'SCHEDULED_DAYS_DEFAULTED'
          | 'REPS_DEFAULTED'
          | 'LAPSES_DEFAULTED'
          | 'LEARNING_STEPS_DEFAULTED'
          | 'STATE_DEFAULTED'
          | 'LAST_REVIEW_MISSING' => flag !== null,
      );
      const reviewCardDigest = await this.dependencies.digest.sha256(
        JSON.stringify({
          schemaVersion: 1,
          migrationId: source.migrationId,
          language: relation.language,
          targetWordId: entry.targetWordId,
          dimension: relation.dimension,
        }),
      );
      assertDigest(reviewCardDigest, 'review card ID');
      const reviewCardId = `review-card-v1:${reviewCardDigest.slice(0, 24)}`;
      const relationId = relationKey(relation.language, entry.targetWordId, relation.dimension);
      const existing = fsrsCardPayloadByRelation.get(relationId);
      if (existing) {
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'fsrsCards',
            'DUPLICATE_FSRS_CARD',
            existing.reviewCardId,
            existing.sourceRefs[0],
          ),
        );
        continue;
      }
      const payload = MigrationIsolatedFsrsCardSchema.parse({
        schemaVersion: 1,
        reviewCardId,
        targetWordId: entry.targetWordId,
        language: relation.language,
        dimension: relation.dimension,
        rawKey: relation.rawKey,
        due: due.value,
        stability: stability.value,
        difficulty: difficulty.value,
        elapsedDays: elapsedDays.present ? elapsedDays.value : 0,
        scheduledDays: scheduledDays.present ? scheduledDays.value : 0,
        reps: reps.present ? reps.value : 0,
        lapses: lapses.present ? lapses.value : 0,
        learningSteps: learningSteps.present ? learningSteps.value : 0,
        state: state.present ? state.value : 0,
        lastReviewedAt: lastReviewedAt.value,
        algorithm: 'ts-fsrs@v1-adapter',
        sourceRefs: [record.sourceRef],
        sourceRecordDigestsSha256: [record.sourceRecordDigestSha256],
        qualityFlags,
        serializedValues: [record.serializedValue],
      });
      fsrsCardPayloadByRelation.set(relationId, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'fsrsCards', 'FSRS_CARD_MAPPED', reviewCardId),
      );
    }

    const fsrsLogPayloadByFingerprint = new Map<string, MigrationIsolatedFsrsLog>();
    for (const { record, value } of sourceValueRecords(source, 'fsrsLogs')) {
      const logValue = isRecord(value) ? value : null;
      const rawKey = logValue ? readField(logValue, 'key', 'cardKey', 'rawKey') : null;
      const relation = resolveRelationFromValue(logValue, rawKey);
      const entry = resolveWordRelation(wordEntryByRawId, wordEntriesByHeadword, relation);
      if (!entry || !entry.targetWordId || !relation.language || !relation.dimension || !logValue) {
        dispositionRecords.push(
          createQuarantineDisposition(record, 'FSRS_LOG_RELATION_INVALID', 'RELATION_UNRESOLVED'),
        );
        continue;
      }
      const relationId = relationKey(relation.language, entry.targetWordId, relation.dimension);
      const card = fsrsCardPayloadByRelation.get(relationId);
      const rating = readNumberField(logValue, 'rating');
      const reviewedAt = readDateField(logValue, 'review', 'reviewedAt');
      const dueAfter = readDateField(logValue, 'due', 'dueAfter');
      if (
        !card ||
        !rating.present ||
        !Number.isInteger(rating.value) ||
        rating.value < 1 ||
        rating.value > 4 ||
        !reviewedAt.present ||
        !reviewedAt.valid ||
        !reviewedAt.value ||
        (dueAfter.present && !dueAfter.valid)
      ) {
        dispositionRecords.push(
          createQuarantineDisposition(
            record,
            !card ? 'FSRS_LOG_CARD_MISSING' : 'FSRS_LOG_INVALID',
            !card ? 'RELATION_UNRESOLVED' : 'CORRUPT_V1_RECORD',
          ),
        );
        continue;
      }
      const sourceName = readField(logValue, 'source') ?? 'unknown';
      const normalizedRawKey =
        relation.rawKey ?? `${relation.language}:${relation.rawWordId}:${relation.dimension}`;
      const fingerprint = await this.dependencies.digest.sha256(
        JSON.stringify({
          schemaVersion: 1,
          targetWordId: entry.targetWordId,
          language: relation.language,
          dimension: relation.dimension,
          rating: rating.value,
          reviewedAt: reviewedAt.value,
          dueAfter: dueAfter.value,
          source: sourceName,
        }),
      );
      assertDigest(fingerprint, 'review log ID');
      const existing = fsrsLogPayloadByFingerprint.get(fingerprint);
      if (existing) {
        fsrsLogPayloadByFingerprint.set(
          fingerprint,
          MigrationIsolatedFsrsLogSchema.parse({
            ...existing,
            sourceRefs: [...new Set([...existing.sourceRefs, record.sourceRef])].sort(
              compareStrings,
            ),
            sourceRecordDigestsSha256: [
              ...new Set([...existing.sourceRecordDigestsSha256, record.sourceRecordDigestSha256]),
            ].sort(compareStrings),
            serializedValues: [
              ...new Set([...existing.serializedValues, record.serializedValue]),
            ].sort(compareStrings),
          }),
        );
        dispositionRecords.push(
          createDedupedDisposition(
            record,
            'fsrsLogs',
            'DUPLICATE_FSRS_LOG',
            existing.reviewLogId,
            existing.sourceRefs[0],
          ),
        );
        continue;
      }
      const reviewLogId = `review-log-v1:${fingerprint.slice(0, 24)}`;
      const payload = MigrationIsolatedFsrsLogSchema.parse({
        schemaVersion: 1,
        reviewLogId,
        reviewCardId: card.reviewCardId,
        targetWordId: entry.targetWordId,
        language: relation.language,
        dimension: relation.dimension,
        rawKey: normalizedRawKey,
        source: sourceName,
        rating: rating.value,
        reviewedAt: reviewedAt.value,
        dueAfter: dueAfter.value,
        sourceRefs: [record.sourceRef],
        sourceRecordDigestsSha256: [record.sourceRecordDigestSha256],
        serializedValues: [record.serializedValue],
      });
      fsrsLogPayloadByFingerprint.set(fingerprint, payload);
      dispositionRecords.push(
        createMigratedDisposition(record, 'fsrsLogs', 'FSRS_LOG_MAPPED', reviewLogId),
      );
    }

    const handledSourceRefs = new Set(dispositionRecords.map((record) => record.sourceRef));
    const unsupportedBusinessDomains = new Set<MigrationLegacySourceRecord['domain']>([
      'groupProgress',
      'wrongBook',
      'aiConversations',
      'aiQuizHistory',
      'recycleBin',
    ]);
    for (const record of source.records) {
      if (
        handledSourceRefs.has(record.sourceRef) ||
        !unsupportedBusinessDomains.has(record.domain)
      ) {
        continue;
      }
      dispositionRecords.push(
        createQuarantineDisposition(
          record,
          'DOMAIN_NOT_IN_SLICE',
          'DOMAIN_NOT_IMPLEMENTED',
          'warning',
        ),
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
      mastery: [...masteryPayloadByTargetId.values()].sort((left, right) =>
        compareStrings(left.targetWordId, right.targetWordId),
      ),
      studyRecords: [...studyPayloadByFingerprint.values()].sort((left, right) =>
        compareStrings(left.eventId, right.eventId),
      ),
      fsrsCards: [...fsrsCardPayloadByRelation.values()].sort((left, right) =>
        compareStrings(left.reviewCardId, right.reviewCardId),
      ),
      fsrsLogs: [...fsrsLogPayloadByFingerprint.values()].sort((left, right) =>
        compareStrings(left.reviewLogId, right.reviewLogId),
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
