export interface KanaSyllable {
  readonly glyph: string;
  readonly id: string;
  readonly romanization: string;
  readonly row: 'あ行' | 'か行';
}

export const basicHiragana: readonly KanaSyllable[] = Object.freeze([
  { glyph: 'あ', id: 'kana-hiragana-a', romanization: 'a', row: 'あ行' },
  { glyph: 'い', id: 'kana-hiragana-i', romanization: 'i', row: 'あ行' },
  { glyph: 'う', id: 'kana-hiragana-u', romanization: 'u', row: 'あ行' },
  { glyph: 'え', id: 'kana-hiragana-e', romanization: 'e', row: 'あ行' },
  { glyph: 'お', id: 'kana-hiragana-o', romanization: 'o', row: 'あ行' },
  { glyph: 'か', id: 'kana-hiragana-ka', romanization: 'ka', row: 'か行' },
  { glyph: 'き', id: 'kana-hiragana-ki', romanization: 'ki', row: 'か行' },
  { glyph: 'く', id: 'kana-hiragana-ku', romanization: 'ku', row: 'か行' },
  { glyph: 'け', id: 'kana-hiragana-ke', romanization: 'ke', row: 'か行' },
  { glyph: 'こ', id: 'kana-hiragana-ko', romanization: 'ko', row: 'か行' },
]);
