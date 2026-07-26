import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { jpStudyCanonicalCorpusManifest, loadJpStudyCanonicalWords } from '../../src/content';
import {
  StaticCanonicalCorpusContentRepository,
  createCanonicalContentPayload,
  createCanonicalWordIdsPayload,
} from '../../src/infrastructure/content';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

describe('jp-study canonical corpus', () => {
  it('loads the pinned bilingual corpus with the exact migration counts', async () => {
    const words = await loadJpStudyCanonicalWords();
    const repository = new StaticCanonicalCorpusContentRepository({
      manifest: jpStudyCanonicalCorpusManifest,
      words,
      digest,
    });

    await expect(repository.verifyIntegrity()).resolves.toMatchObject({
      valid: true,
      expectedTotalWordCount: 9_828,
      actualTotalWordCount: 9_828,
      expectedLanguageCounts: { ja: 5_906, en: 3_922 },
      actualLanguageCounts: { ja: 5_906, en: 3_922 },
      expectedWordIdsSha256: jpStudyCanonicalCorpusManifest.wordIdsSha256,
      expectedContentSha256: jpStudyCanonicalCorpusManifest.contentSha256,
      errors: [],
    });
    expect(repository.listByLanguage('ja')).toHaveLength(5_906);
    expect(repository.listByLanguage('en')).toHaveLength(3_922);
    expect(repository.findById('ja', 'builtin-ja-core-00005')).toMatchObject({
      headword: '元気',
      reading: 'げんき',
    });
    expect(repository.findById('en', 'builtin-en-import-af375c68eba5f2')).toMatchObject({
      headword: 'brace',
      phonetic: '/bres/',
    });
  });

  it('pins the manifest digests to the normalized v2 payloads', async () => {
    const words = await loadJpStudyCanonicalWords();
    const hash = (text: string) => createHash('sha256').update(text).digest('hex');

    expect(hash(createCanonicalWordIdsPayload(words))).toBe(
      jpStudyCanonicalCorpusManifest.wordIdsSha256,
    );
    expect(hash(createCanonicalContentPayload(words))).toBe(
      jpStudyCanonicalCorpusManifest.contentSha256,
    );
  });

  it('keeps language in identity resolution for shared or legacy references', async () => {
    const words = await loadJpStudyCanonicalWords();
    const repository = new StaticCanonicalCorpusContentRepository({
      manifest: jpStudyCanonicalCorpusManifest,
      words,
      digest,
    });
    const japanese = words.find((word) => word.language === 'ja');

    if (!japanese) {
      throw new Error('Expected a Japanese canonical word');
    }

    expect(repository.resolveIdentity({ language: 'ja', wordId: japanese.id })).toMatchObject({
      status: 'exact',
      word: { id: japanese.id, language: 'ja' },
    });
    expect(repository.resolveIdentity({ language: 'en', wordId: japanese.id })).toMatchObject({
      status: 'language-conflict',
      conflictingWord: { id: japanese.id, language: 'ja' },
    });
  });
});
