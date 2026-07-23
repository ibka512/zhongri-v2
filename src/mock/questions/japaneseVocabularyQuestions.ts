import { QuestionSchema, QuestionType, type Question } from '../../schemas/v1';
import type { StudyItem } from '../../application/study';

const rawQuestions = [
  {
    schemaVersion: 1,
    id: 'demo-question-neko-reading',
    type: QuestionType.Choice,
    language: 'ja',
    skill: 'vocabulary.reading',
    prompt: {
      instruction: '请选择正确读音',
      content: '猫',
    },
    answer: {
      kind: 'choice',
      correctOptionIds: ['neko'],
    },
    options: [
      { id: 'neko', label: 'ねこ' },
      { id: 'inu', label: 'いぬ' },
      { id: 'tori', label: 'とり' },
    ],
    explanation: '「猫」读作「ねこ」，意思是猫。',
    audio: null,
    metadata: {
      source: 'builtin',
      difficulty: 1,
      tags: ['task004', 'mock', 'reading'],
    },
  },
  {
    schemaVersion: 1,
    id: 'demo-question-mizu-meaning',
    type: QuestionType.Choice,
    language: 'ja',
    skill: 'vocabulary.meaning',
    prompt: {
      instruction: '请选择正确释义',
      content: '水',
    },
    answer: {
      kind: 'choice',
      correctOptionIds: ['water'],
    },
    options: [
      { id: 'fire', label: '火' },
      { id: 'water', label: '水' },
      { id: 'wind', label: '风' },
    ],
    explanation: '「水（みず）」表示水。',
    audio: null,
    metadata: {
      source: 'builtin',
      difficulty: 1,
      tags: ['task004', 'mock', 'meaning'],
    },
  },
  {
    schemaVersion: 1,
    id: 'demo-question-library-reading',
    type: QuestionType.Choice,
    language: 'ja',
    skill: 'vocabulary.reading',
    prompt: {
      instruction: '请选择正确读音',
      content: '図書館',
    },
    answer: {
      kind: 'choice',
      correctOptionIds: ['toshokan'],
    },
    options: [
      { id: 'toshokan', label: 'としょかん' },
      { id: 'bijutsukan', label: 'びじゅつかん' },
      { id: 'taishikan', label: 'たいしかん' },
    ],
    explanation: '「図書館」读作「としょかん」，意思是图书馆。',
    audio: null,
    metadata: {
      source: 'builtin',
      difficulty: 2,
      tags: ['task004', 'mock', 'reading'],
    },
  },
] satisfies Question[];

export const japaneseVocabularyQuestions = QuestionSchema.array().parse(rawQuestions);

export const studyDemoItems: readonly StudyItem[] = japaneseVocabularyQuestions.map((question) => ({
  itemId: `demo-item-${question.id}`,
  question,
}));
