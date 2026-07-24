import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import {
  CanonicalContentConflictError,
  StaticCanonicalContentRepository,
} from '../../src/infrastructure/content';
import type { CanonicalWord } from '../../src/schemas/v1';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

function createRepository(words: readonly CanonicalWord[] = jaN5StarterWords) {
  return new StaticCanonicalContentRepository({
    manifest: jaN5StarterManifest,
    words,
    digest,
  });
}

describe('StaticCanonicalContentRepository', () => {
  it('verifies the pinned word count and identity digest', async () => {
    const repository = createRepository();

    await expect(repository.verifyIntegrity()).resolves.toMatchObject({
      valid: true,
      expectedWordCount: 20,
      actualWordCount: 20,
      actualWordIdsSha256: jaN5StarterManifest.wordIdsSha256,
      actualContentSha256: jaN5StarterManifest.contentSha256,
      errors: [],
    });
  });

  it('lists Japanese content and performs exact language-scoped id lookup', () => {
    const repository = createRepository();

    expect(repository.listByLanguage('ja')).toHaveLength(20);
    expect(repository.listByLanguage('en')).toEqual([]);
    expect(repository.findById('ja', 'builtin-ja-core-00012')?.headword).toBe('時計');
    expect(repository.findById('en', 'builtin-ja-core-00012')).toBeNull();
  });

  it('exposes immutable canonical records and manifest metadata', () => {
    const repository = createRepository();
    const word = repository.listByLanguage('ja')[0];

    expect(Object.isFrozen(repository.getManifest())).toBe(true);
    expect(Object.isFrozen(repository.getManifest().source)).toBe(true);
    expect(Object.isFrozen(word)).toBe(true);
    expect(Object.isFrozen(word?.tags)).toBe(true);
    expect(Object.isFrozen(word?.source)).toBe(true);
  });

  it('uses unique normalized headword only as a candidate fallback', () => {
    const repository = createRepository();

    expect(repository.resolveIdentity({ language: 'ja', headword: '　時計 ' })).toMatchObject({
      status: 'candidate',
      word: { id: 'builtin-ja-core-00012' },
    });
  });

  it('returns ambiguous instead of merging same-language homographs', () => {
    const first = jaN5StarterWords[0];
    const homograph = {
      ...first,
      id: 'builtin-ja-test-homograph',
      meaning: '测试用的不同词条身份',
    };
    const repository = createRepository([first, homograph]);

    expect(repository.resolveIdentity({ language: 'ja', headword: first.headword })).toMatchObject({
      status: 'ambiguous',
      candidates: [{ id: first.id }, { id: homograph.id }],
    });
  });

  it('reports a language conflict before considering headword fallback', () => {
    const japanese = jaN5StarterWords[0];
    const english = {
      ...japanese,
      language: 'en' as const,
      headword: 'well',
      reading: null,
      phonetic: '/wɛl/',
    };
    const repository = new StaticCanonicalContentRepository({
      manifest: { ...jaN5StarterManifest, language: 'en' },
      words: [english],
      digest,
    });

    expect(
      repository.resolveIdentity({
        language: 'ja',
        wordId: english.id,
        headword: japanese.headword,
      }),
    ).toMatchObject({
      status: 'language-conflict',
      conflictingWord: { id: english.id, language: 'en' },
    });
  });

  it('rejects duplicate canonical identities at construction time', () => {
    const word = jaN5StarterWords[0];

    expect(() => createRepository([word, word])).toThrow(CanonicalContentConflictError);
  });

  it('fails integrity when the asset count or identity set drifts', async () => {
    const repository = createRepository(jaN5StarterWords.slice(0, -1));

    await expect(repository.verifyIntegrity()).resolves.toMatchObject({
      valid: false,
      actualWordCount: 19,
      errors: [
        'Manifest expects 20 words but loaded 19',
        'Canonical word identity digest does not match the manifest',
        'Canonical word content digest does not match the manifest',
      ],
    });
  });
});
