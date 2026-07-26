import type { StudyItem } from '../study';
import type { CanonicalContentRepositoryPort } from '../../ports';
import {
  QuestionSchema,
  QuestionType,
  TodayPlanSchema,
  type CanonicalWord,
  type Language,
  type LearnerSettingsDailyMinutes,
  type Question,
  type TodayPlan,
} from '../../schemas/v1';

const DAILY_WORD_COUNT = 5;
const CHOICE_OPTION_COUNT = 4;

export type DailyCoursePriorityReason = 'due-review' | 'recent-incorrect';

export interface DailyCoursePriority {
  reason: DailyCoursePriorityReason;
  wordId: string;
}

export interface DailyCourseOptions {
  estimatedMinutes?: LearnerSettingsDailyMinutes;
  language?: Language;
}

export interface DailyCourse {
  items: readonly StudyItem[];
  plan: TodayPlan;
  selectionReasons: Readonly<Record<string, DailyCoursePriorityReason | 'foundation'>>;
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

function selectDailyWords(
  words: readonly CanonicalWord[],
  localDate: string,
  priorities: readonly DailyCoursePriority[],
) {
  if (words.length < DAILY_WORD_COUNT) {
    throw new Error(`Daily course requires at least ${DAILY_WORD_COUNT} canonical words`);
  }

  const start = dateOrdinal(localDate) % words.length;
  const foundation = Array.from(
    { length: words.length },
    (_, index) => words[(start + index) % words.length],
  );
  const wordsById = new Map(words.map((word) => [word.id, word]));
  const selected: CanonicalWord[] = [];
  const reasons: Record<string, DailyCoursePriorityReason | 'foundation'> = {};

  for (const priority of priorities) {
    const word = wordsById.get(priority.wordId);
    if (!word || reasons[word.id]) {
      continue;
    }

    selected.push(word);
    reasons[word.id] = priority.reason;
    if (selected.length === DAILY_WORD_COUNT) {
      break;
    }
  }

  for (const word of foundation) {
    if (selected.length === DAILY_WORD_COUNT) {
      break;
    }
    if (reasons[word.id]) {
      continue;
    }

    selected.push(word);
    reasons[word.id] = 'foundation';
  }

  return { reasons, words: selected };
}

function selectionFingerprint(words: readonly CanonicalWord[]): string {
  let hash = 0x811c9dc5;

  for (const character of words.map((word) => word.id).join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createExplanation(word: CanonicalWord): string {
  const pronunciation = word.reading ?? word.phonetic ?? '无音标';
  return `${word.headword}（${pronunciation}）：${word.meaning}｜${word.partOfSpeech}`;
}

function createChoiceQuestion(
  word: CanonicalWord,
  selectedWords: readonly CanonicalWord[],
  questionIndex: number,
  questionId: string,
  localDate: string,
  language: Language,
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
    language,
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

function createTextQuestion(word: CanonicalWord, questionId: string, language: Language): Question {
  const pronunciation = language === 'ja' ? word.reading : word.phonetic;
  const acceptedAnswers = [...new Set([word.headword, pronunciation].filter(Boolean))];

  return QuestionSchema.parse({
    schemaVersion: 1,
    id: questionId,
    language,
    type: QuestionType.TextInput,
    skill: 'vocabulary-recall',
    prompt: {
      instruction:
        language === 'ja' ? '根据中文释义输入日语词或读音' : '根据中文释义输入英语单词或音标',
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
  priorities: readonly DailyCoursePriority[] = [],
  options: DailyCourseOptions = {},
): DailyCourse {
  const manifest = repository.getManifest();
  const language = options.language ?? 'ja';
  const estimatedMinutes = options.estimatedMinutes ?? 5;
  const selection = selectDailyWords(repository.listByLanguage(language), localDate, priorities);
  const words = selection.words;
  const planId = `today-${language}-${localDate}-${manifest.id}-c${manifest.contentVersion}-p2-${selectionFingerprint(words)}`;
  const questions = words.map((word, questionIndex) => {
    const questionId = `${planId}-q${questionIndex + 1}`;
    return questionIndex % 2 === 0
      ? createChoiceQuestion(word, words, questionIndex, questionId, localDate, language)
      : createTextQuestion(word, questionId, language);
  });
  const plan = TodayPlanSchema.parse({
    schemaVersion: 1,
    id: planId,
    localDate,
    language,
    sourceManifestId: manifest.id,
    sourceContentVersion: manifest.contentVersion,
    estimatedMinutes,
    title: language === 'ja' ? '今日 N5 日语' : '今日英语',
    items: words.map((word, index) => ({
      itemId: word.id,
      wordId: word.id,
      questionId: questions[index].id,
      questionType: questions[index].type,
    })),
  });

  return {
    plan,
    selectionReasons: selection.reasons,
    words,
    items: questions.map((question, index) => ({
      itemId: words[index].id,
      question,
    })),
  };
}
