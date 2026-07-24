import type { StudyItem } from '../study';
import type { CanonicalContentRepositoryPort } from '../../ports';
import {
  QuestionSchema,
  QuestionType,
  TodayPlanSchema,
  type CanonicalWord,
  type Question,
  type TodayPlan,
} from '../../schemas/v1';

const DAILY_WORD_COUNT = 5;
const CHOICE_OPTION_COUNT = 4;

export interface DailyCourse {
  items: readonly StudyItem[];
  plan: TodayPlan;
  words: readonly CanonicalWord[];
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateOrdinal(localDate: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function selectDailyWords(words: readonly CanonicalWord[], localDate: string) {
  if (words.length < DAILY_WORD_COUNT) {
    throw new Error(`Daily course requires at least ${DAILY_WORD_COUNT} canonical words`);
  }

  const start = dateOrdinal(localDate) % words.length;
  return Array.from(
    { length: DAILY_WORD_COUNT },
    (_, index) => words[(start + index) % words.length],
  );
}

function createExplanation(word: CanonicalWord): string {
  return `${word.headword}（${word.reading}）：${word.meaning}｜${word.partOfSpeech}`;
}

function createChoiceQuestion(
  word: CanonicalWord,
  selectedWords: readonly CanonicalWord[],
  questionIndex: number,
  questionId: string,
  localDate: string,
): Question {
  const distractors = selectedWords
    .filter((candidate) => candidate.id !== word.id)
    .slice(0, CHOICE_OPTION_COUNT - 1);
  const optionWords = [...distractors];
  const correctPosition = (dateOrdinal(localDate) + questionIndex) % CHOICE_OPTION_COUNT;
  optionWords.splice(correctPosition, 0, word);

  return QuestionSchema.parse({
    schemaVersion: 1,
    id: questionId,
    language: 'ja',
    type: QuestionType.Choice,
    skill: 'vocabulary-meaning',
    prompt: {
      instruction: '选择最符合的中文释义',
      content: word.headword,
    },
    options: optionWords.map((optionWord) => ({
      id: `${questionId}-option-${optionWord.id}`,
      label: optionWord.meaning,
    })),
    answer: {
      kind: 'choice',
      correctOptionIds: [`${questionId}-option-${word.id}`],
    },
    explanation: createExplanation(word),
    audio: null,
    metadata: {
      source: 'builtin',
      difficulty: Math.max(1, word.difficulty),
      tags: ['daily-course', word.level, word.id],
    },
  });
}

function createTextQuestion(word: CanonicalWord, questionId: string): Question {
  const acceptedAnswers = [...new Set([word.headword, word.reading].filter(Boolean))];

  return QuestionSchema.parse({
    schemaVersion: 1,
    id: questionId,
    language: 'ja',
    type: QuestionType.TextInput,
    skill: 'vocabulary-recall',
    prompt: {
      instruction: '根据中文释义输入日语词或读音',
      content: word.meaning,
    },
    options: [],
    answer: {
      kind: 'textInput',
      acceptedAnswers,
      caseSensitive: false,
      trimWhitespace: true,
    },
    explanation: createExplanation(word),
    audio: null,
    metadata: {
      source: 'builtin',
      difficulty: Math.max(1, word.difficulty),
      tags: ['daily-course', word.level, word.id],
    },
  });
}

export function createDailyCourse(
  repository: CanonicalContentRepositoryPort,
  localDate: string,
): DailyCourse {
  const manifest = repository.getManifest();
  const words = selectDailyWords(repository.listByLanguage('ja'), localDate);
  const planId = `today-ja-${localDate}-${manifest.id}-c${manifest.contentVersion}-p1`;
  const questions = words.map((word, questionIndex) => {
    const questionId = `${planId}-q${questionIndex + 1}`;
    return questionIndex % 2 === 0
      ? createChoiceQuestion(word, words, questionIndex, questionId, localDate)
      : createTextQuestion(word, questionId);
  });
  const plan = TodayPlanSchema.parse({
    schemaVersion: 1,
    id: planId,
    localDate,
    language: 'ja',
    sourceManifestId: manifest.id,
    sourceContentVersion: manifest.contentVersion,
    estimatedMinutes: 5,
    title: '今日 N5 日语',
    items: words.map((word, index) => ({
      itemId: word.id,
      wordId: word.id,
      questionId: questions[index].id,
      questionType: questions[index].type,
    })),
  });

  return {
    plan,
    words,
    items: questions.map((question, index) => ({
      itemId: words[index].id,
      question,
    })),
  };
}
