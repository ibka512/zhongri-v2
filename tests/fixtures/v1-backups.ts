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

/**
 * Field-shape-only fixture for the first v1 → v2 domain transformer slice.
 * It intentionally contains one orphan override so the disposition report
 * proves that a relation can be quarantined without creating an active target.
 */
export function createCoreDomainSliceV1Backup(includeOrphanOverride = true) {
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
          _id: 'builtin-ja-core-00005',
          lang: 'ja',
          word: '元気',
          kana: 'げんき',
          meaning: '精神充沛，健康。',
        },
      ],
      userWords: [
        {
          _id: 'user-legacy-001',
          lang: 'ja',
          word: '猫',
          kana: 'ねこ',
          meaning: '猫。',
        },
      ],
      wordOverrides: {
        'builtin-ja-core-00005': { meaning: '有精神；健康。', lang: 'ja' },
        ...(includeOrphanOverride
          ? { 'missing-word-001': { meaning: '不可关联', lang: 'ja' } }
          : {}),
      },
      wordStorageVersion: 1,
      folders: ['日语基础'],
      folderLangs: { 日语基础: 'ja' },
      stars: ['builtin-ja-core-00005', 'user-legacy-001'],
      records: [],
      mtGroupClears: {},
      mtWordClears: {},
      aiConversations: [],
      fsrsCards: {},
      fsrsReviewLogs: [],
      wrongBook: {},
      aiQuizHistory: [],
      recycleBin: [],
    },
    preferences: { theme: 'dark' },
  };
}

/**
 * Synthetic field-shape fixture for the second migration transformer slice.
 * It exercises mastery, date-only study events, one valid legacy FSRS card,
 * a duplicate review log, and an orphan review log that must be quarantined.
 */
export function createMasteryStudyFsrsDomainSliceV1Backup() {
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
          _id: 'builtin-ja-core-00005',
          lang: 'ja',
          word: '元気',
          kana: 'げんき',
          meaning: '精神充沛，健康。',
        },
      ],
      userWords: [],
      wordOverrides: {},
      wordStorageVersion: 1,
      folders: [],
      folderLangs: {},
      stars: [],
      records: [
        { date: '2026-07-23', type: 'daily_punch' },
        { date: '2026-07-23', type: 'pendulum', group: '日语基础' },
        { date: '2026-07-23', type: 'daily_punch' },
        { date: 'not-a-date', type: 'future_type' },
      ],
      mtGroupClears: {},
      mtWordClears: {
        'ja:builtin-ja-core-00005': {
          kanji: true,
          kana: true,
          meaning: false,
          needsReview: true,
        },
      },
      aiConversations: [],
      fsrsCards: {
        'ja:builtin-ja-core-00005:meaning': {
          wordId: 'builtin-ja-core-00005',
          due: '2026-07-25T00:00:00.000Z',
          stability: 2.3,
          difficulty: 4.2,
          elapsed_days: 1,
          scheduled_days: 2,
          reps: 3,
          lapses: 0,
          learning_steps: 0,
          state: 2,
          last_review: '2026-07-24T00:00:00.000Z',
        },
        'ja:missing-word:meaning': {
          wordId: 'missing-word',
          due: '2026-07-25T00:00:00.000Z',
          stability: 2.3,
          difficulty: 4.2,
          elapsed_days: 1,
          scheduled_days: 2,
          reps: 3,
          lapses: 0,
          learning_steps: 0,
          state: 2,
          last_review: '2026-07-24T00:00:00.000Z',
        },
      },
      fsrsReviewLogs: [
        {
          key: 'ja:builtin-ja-core-00005:meaning',
          wordId: 'builtin-ja-core-00005',
          lang: 'ja',
          dimension: 'meaning',
          source: 'study',
          rating: 3,
          review: '2026-07-24T00:00:00.000Z',
          due: '2026-07-25T00:00:00.000Z',
        },
        {
          key: 'ja:builtin-ja-core-00005:meaning',
          wordId: 'builtin-ja-core-00005',
          lang: 'ja',
          dimension: 'meaning',
          source: 'study',
          rating: 3,
          review: '2026-07-24T00:00:00.000Z',
          due: '2026-07-25T00:00:00.000Z',
        },
        {
          key: 'ja:missing-word:meaning',
          wordId: 'missing-word',
          lang: 'ja',
          dimension: 'meaning',
          source: 'study',
          rating: 3,
          review: '2026-07-24T00:00:00.000Z',
          due: '2026-07-25T00:00:00.000Z',
        },
      ],
      wrongBook: {},
      aiQuizHistory: [],
      recycleBin: [],
    },
    preferences: { theme: 'dark' },
  };
}
