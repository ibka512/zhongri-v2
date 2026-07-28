import { describe, expect, it } from 'vitest';

import { englishIpaStarterWordIds, selectEnglishIpaStarterWords } from '../../src/content';
import { CanonicalWordSchema } from '../../src/schemas/v1';

const words = englishIpaStarterWordIds.map((id, index) =>
  CanonicalWordSchema.parse({
    schemaVersion: 1,
    id,
    language: 'en',
    headword: `word-${index}`,
    reading: null,
    phonetic: `/word-${index}/`,
    partOfSpeech: 'noun',
    meaning: `含义 ${index}`,
    level: 'CET-4',
    difficulty: 1,
    tags: ['starter'],
    isBuiltIn: true,
    dataVersion: 1,
    source: {
      manifestId: 'test-manifest',
      sourceName: 'test',
      sourceVersion: 'test',
    },
  }),
);

describe('selectEnglishIpaStarterWords', () => {
  it('returns the fixed canonical starter words in a stable order', () => {
    const selected = selectEnglishIpaStarterWords([...words].reverse());

    expect(selected.map((word) => word.id)).toEqual(englishIpaStarterWordIds);
    expect(Object.isFrozen(selected)).toBe(true);
  });

  it('fails closed when a fixed word is missing or has no phonetic', () => {
    expect(() => selectEnglishIpaStarterWords(words.slice(0, -1))).toThrow(
      'Canonical English IPA starter content is incomplete',
    );

    const missingPhonetic = words.map((word, index) =>
      index === 0 ? CanonicalWordSchema.parse({ ...word, phonetic: null }) : word,
    );
    expect(() => selectEnglishIpaStarterWords(missingPhonetic)).toThrow(
      'Canonical English IPA starter content is incomplete',
    );
  });
});
