import { describe, expect, it } from 'vitest';

import { QuestionSchema, QuestionType } from '../../src/schemas/v1';

const validChoiceQuestion = {
  schemaVersion: 1,
  id: 'question-ja-001',
  type: QuestionType.Choice,
  language: 'ja',
  skill: 'vocabulary',
  prompt: {
    instruction: '请选择正确的中文释义。',
    content: '時計',
  },
  answer: {
    kind: 'choice',
    correctOptionIds: ['option-clock'],
  },
  options: [
    {
      id: 'option-clock',
      label: '钟表',
    },
    {
      id: 'option-phone',
      label: '电话',
    },
  ],
  explanation: '「時計」表示钟表。',
  audio: null,
  metadata: {
    source: 'builtin',
    difficulty: 1,
    tags: ['noun'],
  },
} as const;

describe('QuestionSchema v1', () => {
  it('accepts a valid choice question', () => {
    expect(QuestionSchema.safeParse(validChoiceQuestion).success).toBe(true);
  });

  it('accepts text input with optional audio', () => {
    const question = {
      ...validChoiceQuestion,
      id: 'question-en-001',
      type: QuestionType.TextInput,
      language: 'en',
      prompt: {
        instruction: '听音频并输入单词。',
        content: '请输入你听到的英文单词。',
      },
      answer: {
        kind: 'textInput',
        acceptedAnswers: ['clock'],
        caseSensitive: false,
        trimWhitespace: true,
      },
      options: [],
      audio: {
        kind: 'tts',
        text: 'clock',
        playbackRate: 0.9,
      },
    };

    expect(QuestionSchema.safeParse(question).success).toBe(true);
  });

  it('accepts an audio choice question only when audio is present', () => {
    const question = {
      ...validChoiceQuestion,
      id: 'question-ja-audio-001',
      type: QuestionType.AudioChoice,
      audio: {
        kind: 'asset',
        assetId: 'audio-ja-001',
      },
    };

    expect(QuestionSchema.safeParse(question).success).toBe(true);
    expect(QuestionSchema.safeParse({ ...question, audio: null }).success).toBe(false);
  });

  it('rejects a correct option id that does not exist', () => {
    const question = {
      ...validChoiceQuestion,
      answer: {
        kind: 'choice',
        correctOptionIds: ['missing-option'],
      },
    };

    expect(QuestionSchema.safeParse(question).success).toBe(false);
  });

  it('reserves but does not accept future question structures in v1', () => {
    const question = {
      ...validChoiceQuestion,
      type: QuestionType.Grammar,
    };

    expect(QuestionSchema.safeParse(question).success).toBe(false);
  });
});
