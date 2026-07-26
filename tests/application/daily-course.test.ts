import { describe, expect, it } from 'vitest';

import { createDailyCourse } from '../../src/application/course';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import { CanonicalWordSchema, QuestionSchema, QuestionType } from '../../src/schemas/v1';

const repository: CanonicalContentRepositoryPort = {
  getManifest: () => jaN5StarterManifest,
  listByLanguage: (language) => (language === 'ja' ? jaN5StarterWords : []),
  findById: (language, wordId) =>
    jaN5StarterWords.find((word) => word.language === language && word.id === wordId) ?? null,
  resolveIdentity: () => ({ status: 'not-found' }),
  verifyIntegrity: async () => {
    throw new Error('Integrity verification belongs to the composition root');
  },
};

const englishWords = jaN5StarterWords.map((word, index) =>
  CanonicalWordSchema.parse({
    ...word,
    id: `en-${String(index + 1).padStart(3, '0')}`,
    language: 'en',
    headword: `word-${index + 1}`,
    reading: word.phonetic,
    meaning: `meaning ${index + 1}`,
  }),
);

const bilingualRepository: CanonicalContentRepositoryPort = {
  ...repository,
  listByLanguage: (language) => (language === 'en' ? englishWords : jaN5StarterWords),
  findById: (language, wordId) =>
    (language === 'en' ? englishWords : jaN5StarterWords).find((word) => word.id === wordId) ??
    null,
};

describe('createDailyCourse', () => {
  it('creates a stable five-word plan with three choice and two text questions', () => {
    const first = createDailyCourse(repository, '2026-07-24');
    const second = createDailyCourse(repository, '2026-07-24');

    expect(second).toEqual(first);
    expect(first.items).toHaveLength(5);
    expect(new Set(first.plan.items.map((item) => item.wordId))).toHaveLength(5);
    expect(first.items.map((item) => item.question.type)).toEqual([
      QuestionType.Choice,
      QuestionType.TextInput,
      QuestionType.Choice,
      QuestionType.TextInput,
      QuestionType.Choice,
    ]);
    expect(first.items.every((item) => QuestionSchema.safeParse(item.question).success)).toBe(true);
  });

  it('rolls the canonical selection forward on the next local date', () => {
    const today = createDailyCourse(repository, '2026-07-24');
    const tomorrow = createDailyCourse(repository, '2026-07-25');

    expect(tomorrow.plan.id).not.toBe(today.plan.id);
    expect(tomorrow.plan.items.map((item) => item.wordId)).not.toEqual(
      today.plan.items.map((item) => item.wordId),
    );
  });

  it('uses the selected language and target duration in the daily course contract', () => {
    const course = createDailyCourse(bilingualRepository, '2026-07-24', [], {
      estimatedMinutes: 10,
      language: 'en',
    });

    expect(course.plan.language).toBe('en');
    expect(course.plan.estimatedMinutes).toBe(10);
    expect(course.plan.title).toBe('今日英语');
    expect(course.items.every((item) => item.question.language === 'en')).toBe(true);
    expect(
      course.items.some(
        (item) => item.question.prompt.instruction === '根据中文释义输入英语单词或音标',
      ),
    ).toBe(true);
  });

  it('keeps choice distractors unique and text answers tied to canonical words', () => {
    const course = createDailyCourse(repository, '2026-07-24');

    for (const [index, item] of course.items.entries()) {
      const word = course.words[index];
      if (item.question.type === QuestionType.Choice) {
        expect(new Set(item.question.options.map((option) => option.id))).toHaveLength(4);
        expect(item.question.options).toContainEqual(
          expect.objectContaining({ label: word.meaning }),
        );
      } else {
        expect(item.question.answer.acceptedAnswers).toContain(word.headword);
        expect(item.question.answer.acceptedAnswers).toContain(word.reading);
      }
    }
  });

  it('places due reviews before recent mistakes and then fills deterministically', () => {
    const baseline = createDailyCourse(repository, '2026-07-24');
    const dueWord = jaN5StarterWords.at(-1);
    const weakWord = jaN5StarterWords.at(-2);
    if (!dueWord || !weakWord) {
      throw new Error('Starter content requires priority fixtures');
    }

    const prioritized = createDailyCourse(repository, '2026-07-24', [
      { wordId: dueWord.id, reason: 'due-review' },
      { wordId: weakWord.id, reason: 'recent-incorrect' },
      { wordId: dueWord.id, reason: 'recent-incorrect' },
      { wordId: 'unknown-word', reason: 'due-review' },
    ]);
    const replayed = createDailyCourse(repository, '2026-07-24', [
      { wordId: dueWord.id, reason: 'due-review' },
      { wordId: weakWord.id, reason: 'recent-incorrect' },
    ]);

    expect(prioritized.words.slice(0, 2).map((word) => word.id)).toEqual([dueWord.id, weakWord.id]);
    expect(prioritized.selectionReasons[dueWord.id]).toBe('due-review');
    expect(prioritized.selectionReasons[weakWord.id]).toBe('recent-incorrect');
    expect(prioritized.words).toHaveLength(5);
    expect(new Set(prioritized.words.map((word) => word.id))).toHaveLength(5);
    expect(replayed).toEqual(prioritized);
    expect(prioritized.plan.id).not.toBe(baseline.plan.id);
  });
});
