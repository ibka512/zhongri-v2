import type { TextDigestPort } from '../../ports';
import {
  MigrationDomainSliceResultSchema,
  MigrationLegacySourceSchema,
  migrationSamplingCategoryOrder,
  MigrationSamplingEvidenceSchema,
  type MigrationDomainSliceResult,
  type MigrationLegacySource,
  type MigrationLegacySourceRecord,
  type MigrationSamplingCategory,
  type MigrationSamplingCategoryResult,
  type MigrationSamplingEvidence,
} from '../../schemas/v1';

export interface MigrationFixedSamplingDependencies {
  digest: TextDigestPort;
}

export interface CreateMigrationFixedSamplingInput {
  source: MigrationLegacySource;
  slice: MigrationDomainSliceResult;
}

export class MigrationFixedSamplingInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationFixedSamplingInputError';
  }
}

interface PayloadBinding {
  collection: string;
  sourceRefs: readonly string[];
  sourceRecordDigestsSha256: readonly string[];
  archiveKind: 'rawArchive' | 'quarantine' | null;
  archiveRef: string | null;
}

const PAYLOAD_COLLECTIONS = [
  'words',
  'overrides',
  'folders',
  'favorites',
  'mastery',
  'studyRecords',
  'groupProgress',
  'wrongBook',
  'recycleBin',
  'aiConversations',
  'aiQuizHistory',
  'preferences',
  'reminderSettings',
  'fsrsCards',
  'fsrsLogs',
  'archives',
] as const;

const RELATED_DOMAIN_CATEGORY: ReadonlyMap<
  MigrationLegacySourceRecord['domain'],
  MigrationSamplingCategory
> = new Map([
  ['favorites', 'related-favorites'],
  ['folders', 'related-folders'],
  ['mastery', 'related-mastery'],
  ['studyRecords', 'related-studyRecords'],
  ['groupProgress', 'related-groupProgress'],
  ['wrongBook', 'related-wrongBook'],
  ['aiConversations', 'related-aiConversations'],
  ['aiQuizHistory', 'related-aiQuizHistory'],
  ['recycleBin', 'related-recycleBin'],
  ['preferences', 'related-preferences'],
  ['fsrsCards', 'related-fsrsCards'],
  ['fsrsLogs', 'related-fsrsLogs'],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function parseLanguage(record: MigrationLegacySourceRecord): 'ja' | 'en' | null {
  try {
    const value: unknown = JSON.parse(record.serializedValue);
    if (!isRecord(value)) {
      return null;
    }
    const language = value.lang ?? value.language;
    return language === 'ja' || language === 'en' ? language : null;
  } catch {
    return null;
  }
}

function sourceCategory(
  record: MigrationLegacySourceRecord,
  identityBySourceRef: ReadonlyMap<
    string,
    MigrationDomainSliceResult['identityMap']['entries'][number]
  >,
): MigrationSamplingCategory | null {
  if (record.domain === 'words') {
    const identity = identityBySourceRef.get(record.sourceRef);
    const language = identity?.language ?? parseLanguage(record);
    if (language !== 'ja' && language !== 'en') {
      return null;
    }
    const targetKind =
      identity?.targetKind ?? (record.sourceRef.startsWith('data.db[') ? 'canonical' : 'user');
    return targetKind === 'canonical'
      ? language === 'ja'
        ? 'builtin-ja'
        : 'builtin-en'
      : 'user-words';
  }
  if (record.domain === 'overrides') {
    return 'overrides';
  }
  return RELATED_DOMAIN_CATEGORY.get(record.domain) ?? null;
}

function hashScore(seed: string, category: string, sourceRef: string): number {
  let hash = 2_166_136_261;
  for (const character of `${seed}:${category}:${sourceRef}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function selectSample(
  records: readonly MigrationLegacySourceRecord[],
  category: MigrationSamplingCategory,
  seed: string,
  limit: number,
): readonly MigrationLegacySourceRecord[] {
  return [...records]
    .sort(
      (left, right) =>
        hashScore(seed, category, left.sourceRef) - hashScore(seed, category, right.sourceRef) ||
        compareStrings(left.sourceRef, right.sourceRef),
    )
    .slice(0, limit);
}

function collectPayloadBindings(
  payload: MigrationDomainSliceResult['isolatedPayload'],
): PayloadBinding[] {
  const rawPayload = payload as unknown as Record<string, unknown>;
  const bindings: PayloadBinding[] = [];
  for (const collection of PAYLOAD_COLLECTIONS) {
    const values = rawPayload[collection];
    if (!Array.isArray(values)) {
      continue;
    }
    for (const value of values) {
      if (!isRecord(value)) {
        continue;
      }
      const sourceRefs = [
        ...readStringArray(value.sourceRefs),
        ...(typeof value.sourceRef === 'string' ? [value.sourceRef] : []),
      ];
      const sourceRecordDigestsSha256 = [
        ...readStringArray(value.sourceRecordDigestsSha256),
        ...(typeof value.sourceRecordDigestSha256 === 'string'
          ? [value.sourceRecordDigestSha256]
          : []),
      ];
      if (sourceRefs.length === 0) {
        continue;
      }
      bindings.push({
        collection,
        sourceRefs: [...new Set(sourceRefs)].sort(compareStrings),
        sourceRecordDigestsSha256: [...new Set(sourceRecordDigestsSha256)].sort(compareStrings),
        archiveKind:
          value.archiveKind === 'rawArchive' || value.archiveKind === 'quarantine'
            ? value.archiveKind
            : null,
        archiveRef: typeof value.archiveRef === 'string' ? value.archiveRef : null,
      });
    }
  }
  return bindings;
}

function checkSampleRecord(
  record: MigrationLegacySourceRecord,
  dispositionBySourceRef: ReadonlyMap<
    string,
    MigrationDomainSliceResult['dispositionReport']['entries'][number]
  >,
  payloadBindings: readonly PayloadBinding[],
): boolean {
  const disposition = dispositionBySourceRef.get(record.sourceRef);
  if (!disposition || disposition.sourceRecordDigestSha256 !== record.sourceRecordDigestSha256) {
    return false;
  }

  const matchingBindings = payloadBindings.filter((binding) =>
    binding.sourceRefs.includes(record.sourceRef),
  );
  const matchingActiveBindings = matchingBindings.filter((binding) => !binding.archiveKind);
  const matchingArchive = matchingBindings.find(
    (binding) =>
      binding.archiveKind === disposition.archiveKind &&
      binding.archiveRef === disposition.archiveRef,
  );
  if (disposition.archiveKind && !matchingArchive) {
    return false;
  }

  if (disposition.outcome === 'quarantined') {
    return (
      matchingArchive?.archiveKind === 'quarantine' &&
      matchingArchive.sourceRecordDigestsSha256.includes(record.sourceRecordDigestSha256)
    );
  }

  if (disposition.outcome === 'deduped') {
    return disposition.targetRefs.length > 0 && disposition.canonicalSourceRef !== null;
  }

  return matchingActiveBindings.some((binding) =>
    binding.sourceRecordDigestsSha256.includes(record.sourceRecordDigestSha256),
  );
}

function categoryLimit(category: MigrationSamplingCategory, availableCount: number): number {
  return category.startsWith('related-')
    ? Math.min(20, availableCount)
    : Math.min(30, availableCount);
}

export class MigrationFixedSamplingUseCase {
  constructor(private readonly dependencies: MigrationFixedSamplingDependencies) {}

  async create(input: CreateMigrationFixedSamplingInput): Promise<MigrationSamplingEvidence> {
    let source: MigrationLegacySource;
    let slice: MigrationDomainSliceResult;
    try {
      source = MigrationLegacySourceSchema.parse(input.source);
      slice = MigrationDomainSliceResultSchema.parse(input.slice);
    } catch {
      throw new MigrationFixedSamplingInputError('固定抽样输入不符合 v1 迁移契约。');
    }
    if (
      source.migrationId !== slice.migrationId ||
      source.sourceFingerprint !== slice.sourceFingerprint
    ) {
      throw new MigrationFixedSamplingInputError(
        '固定抽样的 source 与 isolated slice 身份不一致。',
      );
    }

    const identityBySourceRef = new Map(
      slice.identityMap.entries.map((entry) => [entry.sourceRef, entry]),
    );
    const recordsByCategory = new Map<MigrationSamplingCategory, MigrationLegacySourceRecord[]>();
    for (const category of migrationSamplingCategoryOrder) {
      recordsByCategory.set(category, []);
    }
    for (const record of source.records) {
      const category = sourceCategory(record, identityBySourceRef);
      if (category) {
        recordsByCategory.get(category)?.push(record);
      }
    }

    const dispositionBySourceRef = new Map(
      slice.dispositionReport.entries.map((entry) => [entry.sourceRef, entry]),
    );
    const payloadBindings = collectPayloadBindings(slice.isolatedPayload);
    const categories: MigrationSamplingCategoryResult[] = migrationSamplingCategoryOrder.map(
      (category) => {
        const candidates = recordsByCategory.get(category) ?? [];
        const sample = selectSample(
          candidates,
          category,
          source.sourceFingerprint,
          categoryLimit(category, candidates.length),
        );
        const mismatchSourceRefs = sample
          .filter((record) => !checkSampleRecord(record, dispositionBySourceRef, payloadBindings))
          .map((record) => record.sourceRef)
          .sort(compareStrings);
        return {
          schemaVersion: 1,
          category,
          availableCount: candidates.length,
          sampleCount: sample.length,
          sampledSourceRefs: sample.map((record) => record.sourceRef),
          mismatchSourceRefs,
          passed: mismatchSourceRefs.length === 0,
        };
      },
    );

    const evidenceFields = {
      schemaVersion: 1 as const,
      evidenceKind: 'v1-migration-fixed-sampling' as const,
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      seedSourceFingerprint: source.sourceFingerprint,
      categories,
      passed: categories.every((category) => category.passed),
    };
    const evidenceDigestSha256 = await this.dependencies.digest.sha256(
      JSON.stringify(evidenceFields),
    );
    return MigrationSamplingEvidenceSchema.parse({ ...evidenceFields, evidenceDigestSha256 });
  }
}
