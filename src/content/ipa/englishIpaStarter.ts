import type { CanonicalWord } from '../../schemas/v1';

export const englishIpaStarterWordIds = [
  'builtin-en-cet4-00001',
  'builtin-en-cet4-00002',
  'builtin-en-cet4-00003',
  'builtin-en-cet4-00004',
  'builtin-en-cet4-00005',
  'builtin-en-cet4-00006',
  'builtin-en-cet4-00007',
  'builtin-en-cet4-00008',
  'builtin-en-cet4-00009',
  'builtin-en-cet4-00010',
] as const;

export function selectEnglishIpaStarterWords(
  words: readonly CanonicalWord[],
): readonly CanonicalWord[] {
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const selectedWords = englishIpaStarterWordIds.map((id) => wordsById.get(id));

  if (
    selectedWords.some(
      (word) =>
        !word ||
        word.language !== 'en' ||
        word.headword.trim().length === 0 ||
        word.meaning.trim().length === 0 ||
        !word.phonetic ||
        word.phonetic.trim().length === 0,
    )
  ) {
    throw new Error('Canonical English IPA starter content is incomplete');
  }

  return Object.freeze(selectedWords as CanonicalWord[]);
}
