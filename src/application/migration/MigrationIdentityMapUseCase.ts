import type {
  CanonicalContentRepositoryPort,
  CanonicalIdentityResolution,
  TextDigestPort,
} from '../../ports';
import {
  MigrationIdentityMapEntrySchema,
  MigrationIdentityMapInputSchema,
  MigrationIdentityMapSchema,
  type MigrationIdentityMap,
  type MigrationIdentityMapConfidence,
  type MigrationIdentityMapEntry,
  type MigrationIdentityMapInput,
  type MigrationIdentityMapRecordInput,
  type MigrationIdentityMapReason,
  type MigrationIdentityMapResolution,
  type MigrationIdentitySourceKind,
  type CanonicalWord,
} from '../../schemas/v1';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const WORD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,127}$/;

export interface MigrationIdentityMapDependencies {
  content: CanonicalContentRepositoryPort;
  digest: TextDigestPort;
}

export class MigrationIdentityMapInputError extends Error {
  constructor(
    readonly code:
      'INVALID_INPUT' | 'DUPLICATE_SOURCE_REF' | 'CANONICAL_INTEGRITY_FAILED' | 'DIGEST_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationIdentityMapInputError';
  }
}

interface NormalizedRecord {
  sourceRef: string;
  sourceKind: MigrationIdentitySourceKind;
  language: 'ja' | 'en';
  languageDefaulted: boolean;
  rawWordId: string | null;
  rawHeadword: string | null;
  normalizedHeadword: string | null;
  normalizedFolder: string | null;
  readingOrPhonetic: string | null;
  sourceId: string | null;
  importedAt: string | null;
  isBuiltIn: boolean | null;
  rawRecordDigestSha256: string | null;
}

interface TargetOwner {
  sourceRef: string;
  rawRecordDigestSha256: string | null;
}

interface IdentityMapCounts {
  source: number;
  mapped: number;
  quarantined: number;
  canonical: number;
  user: number;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.normalize('NFKC').trim();
  return normalized || null;
}

function normalizeHeadword(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  return (
    normalized
      .replace(/["'“”‘’`]/g, '')
      .replace(/[\s\u3000]+/g, ' ')
      .trim()
      .toLowerCase() || null
  );
}

function normalizeFolder(value: string | null | undefined): string | null {
  return (
    normalizeNullableText(value)
      ?.replace(/[\s\u3000]+/g, ' ')
      .toLowerCase() ?? null
  );
}

function normalizeWordId(value: string | null | undefined): string | null {
  return normalizeNullableText(value);
}

function isLegalWordId(value: string): boolean {
  return WORD_ID_PATTERN.test(value);
}

function normalizeRecord(record: MigrationIdentityMapRecordInput): NormalizedRecord {
  const rawHeadword = normalizeNullableText(record.headword);
  const reading = normalizeNullableText(record.reading);
  const phonetic = normalizeNullableText(record.phonetic);
  return {
    sourceRef: record.sourceRef.trim(),
    sourceKind: record.sourceKind,
    language: record.language ?? 'ja',
    languageDefaulted: record.language === undefined || record.language === null,
    rawWordId: normalizeWordId(record.wordId),
    rawHeadword,
    normalizedHeadword: normalizeHeadword(rawHeadword),
    normalizedFolder: normalizeFolder(record.folder),
    readingOrPhonetic: reading ?? phonetic,
    sourceId: normalizeNullableText(record.sourceId),
    importedAt: normalizeNullableText(record.importedAt),
    isBuiltIn: record.isBuiltIn ?? null,
    rawRecordDigestSha256: record.rawRecordDigestSha256 ?? null,
  };
}

function createEntryBase(
  record: NormalizedRecord,
): Pick<
  MigrationIdentityMapEntry,
  | 'schemaVersion'
  | 'sourceRef'
  | 'sourceKind'
  | 'language'
  | 'languageDefaulted'
  | 'rawWordId'
  | 'rawHeadword'
  | 'normalizedHeadword'
  | 'normalizedFolder'
  | 'rawRecordDigestSha256'
> {
  return {
    schemaVersion: 1,
    sourceRef: record.sourceRef,
    sourceKind: record.sourceKind,
    language: record.language,
    languageDefaulted: record.languageDefaulted,
    rawWordId: record.rawWordId,
    rawHeadword: record.rawHeadword,
    normalizedHeadword: record.normalizedHeadword,
    normalizedFolder: record.normalizedFolder,
    rawRecordDigestSha256: record.rawRecordDigestSha256,
  };
}

function createMappedEntry(
  record: NormalizedRecord,
  targetWordId: string,
  targetKind: 'canonical' | 'user',
  resolution: MigrationIdentityMapResolution,
  mappingConfidence: MigrationIdentityMapConfidence,
  reasonCode: MigrationIdentityMapReason,
): MigrationIdentityMapEntry {
  return MigrationIdentityMapEntrySchema.parse({
    ...createEntryBase(record),
    outcome: 'mapped',
    resolution,
    mappingConfidence,
    reasonCode,
    quarantineCode: null,
    targetWordId,
    targetKind,
  });
}

function createQuarantinedEntry(
  record: NormalizedRecord,
  resolution: MigrationIdentityMapResolution,
  reasonCode: MigrationIdentityMapReason,
  quarantineCode: NonNullable<MigrationIdentityMapEntry['quarantineCode']>,
): MigrationIdentityMapEntry {
  return MigrationIdentityMapEntrySchema.parse({
    ...createEntryBase(record),
    outcome: 'quarantined',
    resolution,
    mappingConfidence: null,
    reasonCode,
    quarantineCode,
    targetWordId: null,
    targetKind: null,
  });
}

function createIdentityPreimage(record: NormalizedRecord): string {
  return [
    record.language,
    record.normalizedHeadword ?? '',
    record.readingOrPhonetic ?? '',
    record.normalizedFolder ?? '',
    record.sourceId ?? '',
    record.importedAt ?? '',
    record.rawRecordDigestSha256 ?? '',
  ].join('|');
}

function isCanonicalResolutionExact(
  resolution: CanonicalIdentityResolution,
): resolution is { status: 'exact'; word: CanonicalWord } {
  return resolution.status === 'exact';
}

function isCanonicalResolutionCandidate(
  resolution: CanonicalIdentityResolution,
): resolution is { status: 'candidate'; word: CanonicalWord } {
  return resolution.status === 'candidate';
}

function createCounts(entries: readonly MigrationIdentityMapEntry[]): IdentityMapCounts {
  return {
    source: entries.length,
    mapped: entries.filter((entry) => entry.outcome === 'mapped').length,
    quarantined: entries.filter((entry) => entry.outcome === 'quarantined').length,
    canonical: entries.filter((entry) => entry.targetKind === 'canonical').length,
    user: entries.filter((entry) => entry.targetKind === 'user').length,
  };
}

function assertDigest(value: string, label: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new MigrationIdentityMapInputError(
      'DIGEST_FAILED',
      `${label} 没有返回合法的 SHA-256 摘要。`,
    );
  }
}

export class MigrationIdentityMapUseCase {
  constructor(private readonly dependencies: MigrationIdentityMapDependencies) {}

  async create(input: MigrationIdentityMapInput): Promise<MigrationIdentityMap> {
    let parsedInput: MigrationIdentityMapInput;
    try {
      parsedInput = MigrationIdentityMapInputSchema.parse(input);
    } catch {
      throw new MigrationIdentityMapInputError('INVALID_INPUT', '身份映射输入不符合迁移契约。');
    }

    const sourceRefs = new Set<string>();
    for (const record of parsedInput.records) {
      const sourceRef = record.sourceRef.trim();
      if (sourceRefs.has(sourceRef)) {
        throw new MigrationIdentityMapInputError(
          'DUPLICATE_SOURCE_REF',
          `身份映射来源引用重复：${sourceRef}。`,
        );
      }
      sourceRefs.add(sourceRef);
    }

    const integrity = await this.dependencies.content.verifyIntegrity();
    if (!integrity.valid) {
      throw new MigrationIdentityMapInputError(
        'CANONICAL_INTEGRITY_FAILED',
        `canonical 内容完整性校验失败：${integrity.errors.join('；') || '未知错误'}。`,
      );
    }

    const normalizedRecords = parsedInput.records
      .map(normalizeRecord)
      .sort((left, right) => compareStrings(left.sourceRef, right.sourceRef));

    const canonicalIds = new Set<string>();
    for (const language of ['ja', 'en'] as const) {
      for (const word of this.dependencies.content.listByLanguage(language)) {
        canonicalIds.add(word.id);
      }
    }

    const userIdCounts = new Map<string, number>();
    for (const record of normalizedRecords) {
      if (
        record.sourceKind === 'word' &&
        record.isBuiltIn !== true &&
        record.rawWordId &&
        isLegalWordId(record.rawWordId)
      ) {
        userIdCounts.set(record.rawWordId, (userIdCounts.get(record.rawWordId) ?? 0) + 1);
      }
    }

    const reservedUserIds = new Set<string>();
    for (const [wordId, count] of userIdCounts) {
      if (count === 1 && !canonicalIds.has(wordId)) {
        reservedUserIds.add(wordId);
      }
    }

    const targetOwners = new Map<string, TargetOwner>();
    const entries: MigrationIdentityMapEntry[] = [];

    for (const record of normalizedRecords) {
      const entry = await this.resolveRecord({
        record,
        canonicalIds,
        reservedUserIds,
        userIdCounts,
        targetOwners,
      });
      entries.push(entry);
      if (entry.outcome === 'mapped' && entry.targetWordId) {
        targetOwners.set(entry.targetWordId, {
          sourceRef: entry.sourceRef,
          rawRecordDigestSha256: entry.rawRecordDigestSha256,
        });
      }
    }

    const manifest = this.dependencies.content.getManifest();
    const counts = createCounts(entries);
    const digestPayload = JSON.stringify({
      schemaVersion: 1,
      migrationId: parsedInput.migrationId,
      sourceFingerprint: parsedInput.sourceFingerprint,
      canonicalManifestId: manifest.id,
      canonicalManifestDigestSha256: manifest.contentSha256,
      canonicalWordIdsDigestSha256: manifest.wordIdsSha256,
      entries,
      counts,
    });
    const mapDigestSha256 = await this.dependencies.digest.sha256(digestPayload);
    assertDigest(mapDigestSha256, 'idMap');

    return MigrationIdentityMapSchema.parse({
      schemaVersion: 1,
      migrationId: parsedInput.migrationId,
      sourceFingerprint: parsedInput.sourceFingerprint,
      canonicalManifestId: manifest.id,
      canonicalManifestDigestSha256: manifest.contentSha256,
      canonicalWordIdsDigestSha256: manifest.wordIdsSha256,
      entries,
      counts,
      mapDigestSha256,
    });
  }

  private async resolveRecord(input: {
    record: NormalizedRecord;
    canonicalIds: ReadonlySet<string>;
    reservedUserIds: ReadonlySet<string>;
    userIdCounts: ReadonlyMap<string, number>;
    targetOwners: ReadonlyMap<string, TargetOwner>;
  }): Promise<MigrationIdentityMapEntry> {
    const { record, canonicalIds, reservedUserIds, userIdCounts, targetOwners } = input;
    if (!record.rawWordId && !record.normalizedHeadword) {
      return createQuarantinedEntry(record, 'invalid', 'EMPTY_IDENTITY', 'EMPTY_IDENTITY');
    }

    if (record.sourceKind === 'override-reference' && !record.rawWordId) {
      return createQuarantinedEntry(record, 'invalid', 'OVERRIDE_ORPHAN', 'OVERRIDE_ORPHAN');
    }

    const resolution = this.dependencies.content.resolveIdentity({
      language: record.language,
      wordId: record.rawWordId,
      headword: record.rawHeadword,
    });

    if (isCanonicalResolutionExact(resolution)) {
      return createMappedEntry(
        record,
        resolution.word.id,
        'canonical',
        'canonical-exact',
        'exact',
        'CANONICAL_ID_MATCH',
      );
    }

    if (record.rawWordId) {
      const legalUserId = isLegalWordId(record.rawWordId);
      const userIdCount = userIdCounts.get(record.rawWordId) ?? 0;
      const canonicalConflict = canonicalIds.has(record.rawWordId);
      const canPreserveUserId =
        (record.sourceKind === 'word' || record.sourceKind === 'relation') &&
        record.isBuiltIn !== true &&
        legalUserId &&
        userIdCount === 1 &&
        !canonicalConflict;

      if (canPreserveUserId) {
        return createMappedEntry(
          record,
          record.rawWordId,
          'user',
          'user-id-preserved',
          'preserved',
          'USER_ID_PRESERVED',
        );
      }

      if (record.sourceKind !== 'word') {
        return createQuarantinedEntry(
          record,
          resolutionToMapResolution(resolution),
          record.sourceKind === 'override-reference' ? 'OVERRIDE_ORPHAN' : 'RELATION_UNRESOLVED',
          record.sourceKind === 'override-reference' ? 'OVERRIDE_ORPHAN' : 'RELATION_UNRESOLVED',
        );
      }

      if (record.isBuiltIn === true) {
        if (isCanonicalResolutionCandidate(resolution) && !record.normalizedFolder) {
          return createMappedEntry(
            record,
            resolution.word.id,
            'canonical',
            'canonical-headword-candidate',
            'heuristic',
            'CANONICAL_HEADWORD_HEURISTIC',
          );
        }

        return createQuarantinedEntry(
          record,
          resolutionToMapResolution(resolution),
          resolutionReason(resolution, 'BUILT_IN_UNRESOLVED'),
          resolutionQuarantineCode(resolution, 'BUILT_IN_UNRESOLVED'),
        );
      }

      return this.createGeneratedUserEntry({
        record,
        reasonCode: canonicalConflict
          ? 'CANONICAL_ID_CONFLICT_GENERATED'
          : userIdCount > 1
            ? 'USER_ID_DUPLICATE_GENERATED'
            : legalUserId
              ? 'USER_ID_GENERATED'
              : 'INVALID_USER_ID',
        canonicalIds,
        reservedUserIds,
        targetOwners,
      });
    }

    if (record.sourceKind !== 'word') {
      return createQuarantinedEntry(
        record,
        resolutionToMapResolution(resolution),
        record.sourceKind === 'override-reference' ? 'OVERRIDE_ORPHAN' : 'RELATION_UNRESOLVED',
        record.sourceKind === 'override-reference' ? 'OVERRIDE_ORPHAN' : 'RELATION_UNRESOLVED',
      );
    }

    if (record.isBuiltIn === true) {
      if (isCanonicalResolutionCandidate(resolution) && !record.normalizedFolder) {
        return createMappedEntry(
          record,
          resolution.word.id,
          'canonical',
          'canonical-headword-candidate',
          'heuristic',
          'CANONICAL_HEADWORD_HEURISTIC',
        );
      }

      return createQuarantinedEntry(
        record,
        resolutionToMapResolution(resolution),
        resolutionReason(resolution, 'BUILT_IN_UNRESOLVED'),
        resolutionQuarantineCode(resolution, 'BUILT_IN_UNRESOLVED'),
      );
    }

    return this.createGeneratedUserEntry({
      record,
      reasonCode: 'USER_ID_GENERATED',
      canonicalIds,
      reservedUserIds,
      targetOwners,
    });
  }

  private async createGeneratedUserEntry(input: {
    record: NormalizedRecord;
    reasonCode: MigrationIdentityMapReason;
    canonicalIds: ReadonlySet<string>;
    reservedUserIds: ReadonlySet<string>;
    targetOwners: ReadonlyMap<string, TargetOwner>;
  }): Promise<MigrationIdentityMapEntry> {
    const { record, reasonCode, canonicalIds, reservedUserIds, targetOwners } = input;
    if (!record.normalizedHeadword) {
      return createQuarantinedEntry(record, 'invalid', 'EMPTY_IDENTITY', 'EMPTY_IDENTITY');
    }

    if (!record.rawRecordDigestSha256) {
      return createQuarantinedEntry(
        record,
        'user-id-generated',
        'MISSING_RAW_RECORD_DIGEST',
        'MISSING_RAW_RECORD_DIGEST',
      );
    }

    const generatedDigest = await this.dependencies.digest.sha256(createIdentityPreimage(record));
    assertDigest(generatedDigest, '生成用户词 ID');
    const baseId = `user-v1-${generatedDigest.slice(0, 24)}`;
    const variants = [
      baseId,
      `${baseId}-${record.rawRecordDigestSha256.slice(0, 8)}`,
      `${baseId}-${record.rawRecordDigestSha256.slice(0, 16)}`,
      `${baseId}-${record.rawRecordDigestSha256}`,
    ];

    for (const targetWordId of variants) {
      const blocked =
        canonicalIds.has(targetWordId) ||
        reservedUserIds.has(targetWordId) ||
        targetOwners.has(targetWordId);
      if (!blocked) {
        return createMappedEntry(
          record,
          targetWordId,
          'user',
          'user-id-generated',
          'generated',
          reasonCode,
        );
      }

      const existing = targetOwners.get(targetWordId);
      if (existing && existing.rawRecordDigestSha256 === record.rawRecordDigestSha256) {
        return createQuarantinedEntry(
          record,
          'user-id-generated',
          'DUPLICATE_TARGET_ID',
          'DUPLICATE_TARGET_ID',
        );
      }
    }

    return createQuarantinedEntry(
      record,
      'user-id-generated',
      'DUPLICATE_TARGET_ID',
      'DUPLICATE_TARGET_ID',
    );
  }
}

function resolutionToMapResolution(
  resolution: CanonicalIdentityResolution,
): MigrationIdentityMapResolution {
  switch (resolution.status) {
    case 'exact':
      return 'canonical-exact';
    case 'candidate':
      return 'canonical-headword-candidate';
    case 'ambiguous':
      return 'canonical-headword-ambiguous';
    case 'language-conflict':
      return 'canonical-language-conflict';
    case 'not-found':
      return 'not-found';
  }
}

function resolutionReason(
  resolution: CanonicalIdentityResolution,
  fallback: MigrationIdentityMapReason,
): MigrationIdentityMapReason {
  switch (resolution.status) {
    case 'ambiguous':
      return 'CANONICAL_HEADWORD_AMBIGUOUS';
    case 'language-conflict':
      return 'CANONICAL_LANGUAGE_CONFLICT';
    case 'not-found':
      return 'CANONICAL_NOT_FOUND';
    case 'candidate':
      return 'CANONICAL_CONTEXT_REQUIRED';
    case 'exact':
      return fallback;
  }
}

function resolutionQuarantineCode(
  resolution: CanonicalIdentityResolution,
  fallback: NonNullable<MigrationIdentityMapEntry['quarantineCode']>,
): NonNullable<MigrationIdentityMapEntry['quarantineCode']> {
  switch (resolution.status) {
    case 'ambiguous':
      return 'CANONICAL_HEADWORD_AMBIGUOUS';
    case 'language-conflict':
      return 'CANONICAL_LANGUAGE_CONFLICT';
    case 'not-found':
      return 'CANONICAL_NOT_FOUND';
    case 'candidate':
      return 'CANONICAL_CONTEXT_REQUIRED';
    case 'exact':
      return fallback;
  }
}
