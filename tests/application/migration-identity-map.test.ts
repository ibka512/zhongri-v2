import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationIdentityMapInputError,
  MigrationIdentityMapUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import type { CanonicalContentRepositoryPort, CanonicalIdentityResolution } from '../../src/ports';
import type { CanonicalWord, Language } from '../../src/schemas/v1';

const sourceFingerprint = 'b'.repeat(64);
const migrationId = `v1-v2:${'a'.repeat(24)}:spec-1`;

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

function normalizeHeadword(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function createCanonicalRepository(
  additionalWords: readonly CanonicalWord[] = [],
): CanonicalContentRepositoryPort {
  const words = [...jaN5StarterWords, ...additionalWords];
  const findById = (language: Language, wordId: string): CanonicalWord | null =>
    words.find((word) => word.language === language && word.id === wordId.trim()) ?? null;

  return {
    getManifest: () => jaN5StarterManifest,
    listByLanguage: (language) => words.filter((word) => word.language === language),
    findById,
    resolveIdentity: ({ language, wordId, headword }): CanonicalIdentityResolution => {
      const normalizedId = wordId?.trim();
      if (normalizedId) {
        const exact = findById(language, normalizedId);
        if (exact) {
          return { status: 'exact', word: exact };
        }

        const conflictingWord = words.find((word) => word.id === normalizedId);
        if (conflictingWord) {
          return { status: 'language-conflict', conflictingWord };
        }
      }

      const normalizedHeadword = headword ? normalizeHeadword(headword) : null;
      if (!normalizedHeadword) {
        return { status: 'not-found' };
      }

      const candidates = words.filter(
        (word) =>
          word.language === language && normalizeHeadword(word.headword) === normalizedHeadword,
      );
      if (candidates.length === 1) {
        return { status: 'candidate', word: candidates[0] };
      }
      if (candidates.length > 1) {
        return { status: 'ambiguous', candidates };
      }
      return { status: 'not-found' };
    },
    verifyIntegrity: async () => ({
      valid: true,
      expectedWordCount: words.length,
      actualWordCount: words.length,
      expectedWordIdsSha256: jaN5StarterManifest.wordIdsSha256,
      actualWordIdsSha256: jaN5StarterManifest.wordIdsSha256,
      expectedContentSha256: jaN5StarterManifest.contentSha256,
      actualContentSha256: jaN5StarterManifest.contentSha256,
      errors: [],
    }),
  };
}

function createUseCase(repository = createCanonicalRepository()): MigrationIdentityMapUseCase {
  return new MigrationIdentityMapUseCase({ content: repository, digest });
}

function createInput(records: Parameters<MigrationIdentityMapUseCase['create']>[0]['records']) {
  return { migrationId, sourceFingerprint, records };
}

function recordDigest(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

describe('MigrationIdentityMapUseCase', () => {
  it('keeps canonical IDs exact and records a defaulted legacy language', async () => {
    const canonical = jaN5StarterWords[0];
    const map = await createUseCase().create(
      createInput([
        {
          sourceRef: 'myWordDB_v3[0]',
          sourceKind: 'word',
          wordId: canonical.id,
          headword: canonical.headword,
          isBuiltIn: true,
        },
      ]),
    );

    expect(map.entries[0]).toMatchObject({
      outcome: 'mapped',
      language: 'ja',
      languageDefaulted: true,
      resolution: 'canonical-exact',
      mappingConfidence: 'exact',
      targetWordId: canonical.id,
      targetKind: 'canonical',
    });
    expect(map.counts).toEqual({ source: 1, mapped: 1, quarantined: 0, canonical: 1, user: 0 });
  });

  it('generates a deterministic user ID when a legacy ID conflicts across languages', async () => {
    const canonical = jaN5StarterWords[0];
    const map = await createUseCase().create(
      createInput([
        {
          sourceRef: 'userWords_v1[0]',
          sourceKind: 'word',
          language: 'en',
          wordId: canonical.id,
          headword: 'custom word',
          isBuiltIn: false,
          rawRecordDigestSha256: recordDigest('cross-language-user'),
        },
      ]),
    );

    expect(map.entries[0]).toMatchObject({
      outcome: 'mapped',
      resolution: 'user-id-generated',
      mappingConfidence: 'generated',
      reasonCode: 'CANONICAL_ID_CONFLICT_GENERATED',
      targetKind: 'user',
    });
    expect(map.entries[0].targetWordId).toMatch(/^user-v1-[a-f0-9]{24}/);
    expect(map.entries[0].targetWordId).not.toBe(canonical.id);
  });

  it('preserves a unique user ID and deterministically separates duplicate IDs', async () => {
    const records = [
      {
        sourceRef: 'userWords_v1[2]',
        sourceKind: 'word' as const,
        language: 'ja' as const,
        wordId: 'user-legacy-001',
        headword: '保存用户词',
        isBuiltIn: false,
      },
      {
        sourceRef: 'userWords_v1[1]',
        sourceKind: 'word' as const,
        language: 'ja' as const,
        wordId: 'user-duplicate-001',
        headword: '重复甲',
        isBuiltIn: false,
        rawRecordDigestSha256: recordDigest('duplicate-a'),
      },
      {
        sourceRef: 'userWords_v1[3]',
        sourceKind: 'word' as const,
        language: 'ja' as const,
        wordId: 'user-duplicate-001',
        headword: '重复乙',
        isBuiltIn: false,
        rawRecordDigestSha256: recordDigest('duplicate-b'),
      },
    ];

    const first = await createUseCase().create(createInput(records));
    const second = await createUseCase().create(createInput([...records].reverse()));

    expect(first.mapDigestSha256).toBe(second.mapDigestSha256);
    expect(first.entries).toEqual(second.entries);
    expect(first.entries.find((entry) => entry.sourceRef.endsWith('[2]'))).toMatchObject({
      targetWordId: 'user-legacy-001',
      reasonCode: 'USER_ID_PRESERVED',
    });
    const duplicateEntries = first.entries.filter(
      (entry) => entry.rawWordId === 'user-duplicate-001',
    );
    expect(duplicateEntries).toHaveLength(2);
    expect(new Set(duplicateEntries.map((entry) => entry.targetWordId)).size).toBe(2);
    expect(
      duplicateEntries.every((entry) => entry.reasonCode === 'USER_ID_DUPLICATE_GENERATED'),
    ).toBe(true);
  });

  it('uses a conservative built-in headword heuristic and quarantines ambiguity', async () => {
    const ambiguousA = {
      ...jaN5StarterWords[1],
      id: 'builtin-ja-ambiguous-001',
      headword: '同じ词',
    };
    const ambiguousB = {
      ...jaN5StarterWords[2],
      id: 'builtin-ja-ambiguous-002',
      headword: '同じ词',
    };
    const map = await createUseCase(createCanonicalRepository([ambiguousA, ambiguousB])).create(
      createInput([
        {
          sourceRef: 'myWordDB_v3[4]',
          sourceKind: 'word',
          language: 'ja',
          headword: jaN5StarterWords[0].headword,
          isBuiltIn: true,
        },
        {
          sourceRef: 'myWordDB_v3[5]',
          sourceKind: 'word',
          language: 'ja',
          headword: '同じ词',
          isBuiltIn: true,
        },
      ]),
    );

    expect(map.entries[0]).toMatchObject({
      resolution: 'canonical-headword-candidate',
      mappingConfidence: 'heuristic',
      targetKind: 'canonical',
    });
    expect(map.entries[1]).toMatchObject({
      outcome: 'quarantined',
      resolution: 'canonical-headword-ambiguous',
      quarantineCode: 'CANONICAL_HEADWORD_AMBIGUOUS',
    });
  });

  it('keeps overrides and relations fail-closed when their IDs are orphaned', async () => {
    const map = await createUseCase().create(
      createInput([
        {
          sourceRef: 'wordOverrides_v1:missing',
          sourceKind: 'override-reference',
          language: 'ja',
          wordId: 'missing-canonical-id',
          headword: jaN5StarterWords[0].headword,
        },
        {
          sourceRef: 'starredWords[0]',
          sourceKind: 'relation',
          language: 'ja',
          wordId: 'missing-user-id',
          headword: '不存在',
        },
      ]),
    );

    expect(map.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'override-reference',
          outcome: 'quarantined',
          quarantineCode: 'OVERRIDE_ORPHAN',
        }),
        expect.objectContaining({
          sourceKind: 'relation',
          outcome: 'quarantined',
          quarantineCode: 'RELATION_UNRESOLVED',
        }),
      ]),
    );
  });

  it('quarantines missing raw digests, empty identities, and rejects an invalid canonical corpus', async () => {
    const map = await createUseCase().create(
      createInput([
        {
          sourceRef: 'userWords_v1[0]',
          sourceKind: 'word',
          language: 'ja',
          headword: '没有摘要',
          isBuiltIn: false,
        },
        {
          sourceRef: 'userWords_v1[1]',
          sourceKind: 'word',
          language: 'ja',
          isBuiltIn: false,
        },
      ]),
    );

    expect(map.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quarantineCode: 'MISSING_RAW_RECORD_DIGEST' }),
        expect.objectContaining({ quarantineCode: 'EMPTY_IDENTITY' }),
      ]),
    );

    const invalidRepository = createCanonicalRepository();
    invalidRepository.verifyIntegrity = async () => ({
      valid: false,
      expectedWordCount: 1,
      actualWordCount: 0,
      expectedWordIdsSha256: 'a'.repeat(64),
      actualWordIdsSha256: 'b'.repeat(64),
      expectedContentSha256: 'c'.repeat(64),
      actualContentSha256: 'd'.repeat(64),
      errors: ['fixture corpus is incomplete'],
    });

    await expect(createUseCase(invalidRepository).create(createInput([]))).rejects.toMatchObject({
      code: 'CANONICAL_INTEGRITY_FAILED',
    });
  });

  it('rejects duplicate source references before consulting canonical content', async () => {
    let verified = false;
    const repository = createCanonicalRepository();
    repository.verifyIntegrity = async () => {
      verified = true;
      return {
        valid: true,
        expectedWordCount: 0,
        actualWordCount: 0,
        expectedWordIdsSha256: 'a'.repeat(64),
        actualWordIdsSha256: 'a'.repeat(64),
        expectedContentSha256: 'b'.repeat(64),
        actualContentSha256: 'b'.repeat(64),
        errors: [],
      };
    };

    await expect(
      createUseCase(repository).create(
        createInput([
          { sourceRef: 'duplicate', sourceKind: 'relation', language: 'ja', wordId: 'a-001' },
          { sourceRef: ' duplicate ', sourceKind: 'relation', language: 'ja', wordId: 'a-002' },
        ]),
      ),
    ).rejects.toBeInstanceOf(MigrationIdentityMapInputError);
    expect(verified).toBe(false);
  });
});
