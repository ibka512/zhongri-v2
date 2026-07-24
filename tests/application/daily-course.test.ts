import { describe, expect, it } from 'vitest';

import { createDailyCourse } from '../../src/application/course';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import { QuestionSchema, QuestionType } from '../../src/schemas/v1';

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
});
