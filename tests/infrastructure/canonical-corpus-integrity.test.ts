import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { jaN5StarterWords } from '../../src/content';
import {
  createCanonicalContentPayload,
  createCanonicalWordIdsPayload,
  verifyCanonicalCorpusIntegrity,
} from '../../src/infrastructure/content';
import {
  CanonicalCorpusManifestSchema,
  canonicalCorpusV1AcceptanceTarget,
  type CanonicalWord,
} from '../../src/schemas/v1';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

const englishWord: CanonicalWord = {
  ...jaN5StarterWords[0],
  id: 'builtin-en-fixture-0001',
  language: 'en',
  headword: 'hello',
  reading: null,
  phonetic: '/həˈləʊ/',
  meaning: '你好',
  level: 'A1',
  source: {
    manifestId: 'fixture-en-v1',
    sourceName: 'synthetic test fixture',
    sourceVersion: 'test',
  },
};

async function createManifest(words: readonly CanonicalWord[], counts: { ja: number; en: number }) {
  return CanonicalCorpusManifestSchema.parse({
    schemaVersion: 1,
    id: 'fixture-ja-en-v1',
    contentVersion: 1,
    totalWordCount: words.length,
    languageCounts: [
      { language: 'ja', wordCount: counts.ja },
      { language: 'en', wordCount: counts.en },
    ],
    wordIdsSha256: await digest.sha256(createCanonicalWordIdsPayload(words)),
    contentSha256: await digest.sha256(createCanonicalContentPayload(words)),
    source: {
      repository: 'ibka512/zhongri-v2',
      commitSha: 'b'.repeat(40),
      path: 'tests/fixtures/canonical-corpus.json',
      blobSha: 'c'.repeat(40),
      licenseSummary: 'Synthetic fixture only',
    },
  });
}

describe('CanonicalCorpusManifestSchema', () => {
  it('requires exactly one language count for ja and en', () => {
    expect(() =>
      CanonicalCorpusManifestSchema.parse({
        schemaVersion: 1,
        id: 'invalid-fixture',
        contentVersion: 1,
        totalWordCount: 1,
        languageCounts: [
          { language: 'ja', wordCount: 1 },
          { language: 'ja', wordCount: 0 },
        ],
        wordIdsSha256: 'a'.repeat(64),
        contentSha256: 'b'.repeat(64),
        source: {
          repository: 'ibka512/zhongri-v2',
          commitSha: 'b'.repeat(40),
          path: 'fixture.json',
          blobSha: 'c'.repeat(40),
          licenseSummary: 'Synthetic fixture only',
        },
      }),
    ).toThrow();
  });
});

describe('verifyCanonicalCorpusIntegrity', () => {
  it('accepts a complete synthetic bilingual fixture when its manifest matches', async () => {
    const words = [jaN5StarterWords[0], englishWord];
    const manifest = await createManifest(words, { ja: 1, en: 1 });

    await expect(
      verifyCanonicalCorpusIntegrity({ manifest, words, digest }),
    ).resolves.toMatchObject({
      valid: true,
      expectedTotalWordCount: 2,
      actualTotalWordCount: 2,
      expectedLanguageCounts: { ja: 1, en: 1 },
      actualLanguageCounts: { ja: 1, en: 1 },
      errors: [],
    });
  });

  it('reports duplicate identities instead of silently merging them', async () => {
    const words = [jaN5StarterWords[0], { ...jaN5StarterWords[0] }, englishWord];
    const manifest = await createManifest(words, { ja: 2, en: 1 });

    await expect(
      verifyCanonicalCorpusIntegrity({ manifest, words, digest }),
    ).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Duplicate canonical corpus identity "ja:builtin-ja-core-00005"',
      ]),
    });
  });

  it('fails closed when the 9,828-word acceptance target is requested', async () => {
    const words = jaN5StarterWords;
    const manifest = await createManifest(words, { ja: words.length, en: 0 });

    await expect(
      verifyCanonicalCorpusIntegrity({
        manifest,
        words,
        digest,
        acceptanceTarget: canonicalCorpusV1AcceptanceTarget,
      }),
    ).resolves.toMatchObject({
      valid: false,
      expectedTotalWordCount: 20,
      actualTotalWordCount: 20,
      errors: expect.arrayContaining([
        'Canonical corpus manifest target requires 9828 total words',
        'Canonical corpus manifest target requires 5906 ja words',
        'Canonical corpus manifest target requires 3922 en words',
      ]),
    });
  });
});
