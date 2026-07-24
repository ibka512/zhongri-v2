export function createModernV1Backup() {
  return {
    format: 'zhongri-backup',
    backupVersion: 10,
    schemaVersion: 8,
    appName: '钟日',
    kind: 'manual',
    exportDate: '2026-07-23T10:00:00.000Z',
    data: {
      db: [
        {
          _id: 'word-1',
          lang: 'ja',
          word: '猫',
          kana: 'ねこ',
          meaning: '猫',
        },
      ],
      userWords: [],
      wordOverrides: {},
      wordStorageVersion: 1,
      folders: ['日语基础'],
      folderLangs: { 日语基础: 'ja' },
      stars: ['word-1'],
      records: [{ date: '2026-07-23', type: 'study' }],
      mtGroupClears: { '日语基础|all|1': 1 },
      mtWordClears: { 'ja:word-1': { kanji: true, kana: true, meaning: true } },
      aiConversations: [
        {
          id: 'conversation-1',
          date: '2026-07-23T09:00:00.000Z',
          messages: [],
          systemPrompt: 'legacy prompt',
        },
      ],
      fsrsCards: {
        'ja:word-1:reading': {
          wordId: 'word-1',
          due: '2026-07-25T00:00:00.000Z',
        },
      },
      fsrsReviewLogs: [
        {
          wordId: 'word-1',
          lang: 'ja',
          dimension: 'reading',
          rating: 3,
        },
      ],
      wrongBook: {
        'word-1': {
          wrongCount: 1,
        },
      },
      aiQuizHistory: [
        {
          id: 'quiz-1',
          total: 1,
          correct: 1,
          answers: [],
        },
      ],
      recycleBin: [
        {
          id: 'trash-1',
          kind: 'word',
          deletedAt: '2026-07-23T08:00:00.000Z',
          expiresAt: '2026-08-01T08:00:00.000Z',
          payload: {},
        },
      ],
    },
    preferences: {
      theme: 'dark',
    },
  };
}

export function createLegacyV4Backup() {
  return {
    db: [{ _id: 'legacy-word-1', lang: 'ja', word: '犬', kana: 'いぬ' }],
    folders: ['旧词库'],
    folderLangs: { 旧词库: 'ja' },
    stars: ['legacy-word-1'],
    records: [],
    mtGroupClears: {},
    mtWordClears: {},
    aiConversations: [],
    preferences: { theme: 'light' },
    exportDate: '2025-12-01T00:00:00.000Z',
  };
}
