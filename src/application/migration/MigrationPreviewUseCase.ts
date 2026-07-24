import type { TextDigestPort } from '../../ports';
import {
  MigrationPreviewReportSchema,
  type MigrationDomainSummary,
  type MigrationPreviewDomain,
  type MigrationPreviewIssue,
  type MigrationPreviewReport,
} from '../../schemas/v1';

export const MAX_V1_BACKUP_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export interface PreviewV1BackupInput {
  fileName: string;
  fileSize: number;
  text: string;
}

export interface MigrationPreviewDependencies {
  digest: TextDigestPort;
  now: () => Date;
}

interface NormalizedBackup {
  format: 'modern' | 'legacy-v4';
  backupVersion: number;
  dataSchemaVersion: number;
  appName: string;
  kind: string;
  exportDate: string | null;
  data: Record<string, unknown>;
  preferences: Record<string, unknown>;
  unknownTopLevelKeys: string[];
}

type Classification = 'migratable' | 'skipped' | 'conflict' | 'error';

interface WordReferenceIndex {
  ids: Map<string, number>;
  headwords: Map<string, number>;
}

const DOMAIN_ORDER: readonly MigrationPreviewDomain[] = [
  'words',
  'overrides',
  'folders',
  'favorites',
  'studyRecords',
  'mastery',
  'groupProgress',
  'fsrsCards',
  'fsrsLogs',
  'wrongBook',
  'aiConversations',
  'aiQuizHistory',
  'recycleBin',
  'preferences',
  'unknown',
];

const MODERN_TOP_LEVEL_KEYS = new Set([
  'format',
  'backupVersion',
  'schemaVersion',
  'appName',
  'kind',
  'exportDate',
  'data',
  'preferences',
]);

const MODERN_DATA_KEYS = new Set([
  'db',
  'userWords',
  'wordOverrides',
  'wordStorageVersion',
  'folders',
  'folderLangs',
  'stars',
  'records',
  'mtGroupClears',
  'mtWordClears',
  'aiConversations',
  'fsrsCards',
  'fsrsReviewLogs',
  'wrongBook',
  'aiQuizHistory',
  'recycleBin',
]);

const LEGACY_TOP_LEVEL_KEYS = new Set([
  'db',
  'folders',
  'folderLangs',
  'stars',
  'records',
  'mtGroupClears',
  'mtWordClears',
  'aiConversations',
  'preferences',
  'exportDate',
]);

const MIGRATION_ASSUMPTIONS = [
  {
    id: 'Q1',
    decision: '默认原位升级；备份恢复作为独立、显式入口，不自动混合。',
  },
  {
    id: 'Q2',
    decision: '已过期回收站项只存档，不进入活跃回收站。',
  },
  {
    id: 'Q3',
    decision: '同名旧收藏或掌握保持 v1 多匹配行为，并标记 ambiguous。',
  },
  {
    id: 'Q4',
    decision: '混合语言同名文件夹按 language + name 拆分，显示名不改。',
  },
  {
    id: 'Q5',
    decision: 'DeepSeek API Key 明文不迁移，只提示用户重新输入。',
  },
  {
    id: 'Q6',
    decision: '旧迁移快照与导入恢复点仅作内部只读存档，不作为全量恢复入口。',
  },
  {
    id: 'Q7',
    decision: '历史 word.srs 坚持只存档，不激活为 ReviewState。',
  },
  {
    id: 'Q8',
    decision: 'AI 会话 systemPrompt 与会话一起迁移并保留审计关系。',
  },
  {
    id: 'Q9',
    decision: '词根审核动态键属于可选存档，不阻断核心迁移。',
  },
  {
    id: 'Q10',
    decision: 'Word、Override、FSRS 活跃记录孤立为 P0 阻断；偏好和工具数据非阻断。',
  },
  {
    id: 'Q11',
    decision: '备份冲突采用独立 migrationId 整包覆盖，不自动字段合并。',
  },
  {
    id: 'Q12',
    decision: 'v1 原始数据至少保留一个稳定版本周期，并在用户确认后清理。',
  },
] as const;

export class MigrationPreviewInputError extends Error {
  constructor(
    readonly code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'INVALID_JSON' | 'UNKNOWN_FORMAT',
    message: string,
  ) {
    super(message);
    this.name = 'MigrationPreviewInputError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNonnegativeInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeBackup(raw: unknown): NormalizedBackup {
  if (!isRecord(raw)) {
    throw new MigrationPreviewInputError(
      'UNKNOWN_FORMAT',
      '无法识别此备份文件。请选择 JSON 备份。',
    );
  }

  if (raw.format === 'zhongri-backup') {
    if (!isRecord(raw.data)) {
      throw new MigrationPreviewInputError(
        'UNKNOWN_FORMAT',
        '备份缺少 data 数据区。请重新从旧版钟日导出。',
      );
    }

    const backupVersion = toNonnegativeInteger(raw.backupVersion, 5);
    if (backupVersion < 5) {
      throw new MigrationPreviewInputError(
        'UNKNOWN_FORMAT',
        '无法识别此备份格式。现代 zhongri-backup 必须为 v5 或更高版本。',
      );
    }

    const preferences = isRecord(raw.preferences) ? raw.preferences : {};
    return {
      format: 'modern',
      backupVersion,
      dataSchemaVersion: toNonnegativeInteger(raw.schemaVersion, 1),
      appName: typeof raw.appName === 'string' && raw.appName.trim() ? raw.appName.trim() : '钟日',
      kind: typeof raw.kind === 'string' && raw.kind.trim() ? raw.kind.trim() : 'manual',
      exportDate: normalizeDate(raw.exportDate),
      data: raw.data,
      preferences,
      unknownTopLevelKeys: Object.keys(raw).filter((key) => !MODERN_TOP_LEVEL_KEYS.has(key)),
    };
  }

  if (Array.isArray(raw.db) && Array.isArray(raw.folders)) {
    const preferences = isRecord(raw.preferences) ? raw.preferences : {};
    const data = Object.fromEntries(
      [...LEGACY_TOP_LEVEL_KEYS]
        .filter((key) => key !== 'preferences' && key !== 'exportDate')
        .map((key) => [key, raw[key]]),
    );

    return {
      format: 'legacy-v4',
      backupVersion: 4,
      dataSchemaVersion: 0,
      appName: '钟日',
      kind: 'legacy',
      exportDate: normalizeDate(raw.exportDate),
      data,
      preferences,
      unknownTopLevelKeys: Object.keys(raw).filter((key) => !LEGACY_TOP_LEVEL_KEYS.has(key)),
    };
  }

  throw new MigrationPreviewInputError(
    'UNKNOWN_FORMAT',
    '无法识别此备份格式。当前支持 zhongri-backup v5+ 和旧 v4 JSON。',
  );
}

function createSummary(domain: MigrationPreviewDomain): MigrationDomainSummary {
  return {
    domain,
    sourceCount: 0,
    migratableCount: 0,
    skippedCount: 0,
    conflictCount: 0,
    errorCount: 0,
    notes: [],
  };
}

function applyClassifications(
  summary: MigrationDomainSummary,
  classifications: readonly Classification[],
): void {
  summary.sourceCount += classifications.length;

  for (const classification of classifications) {
    if (classification === 'migratable') {
      summary.migratableCount += 1;
    } else if (classification === 'skipped') {
      summary.skippedCount += 1;
    } else if (classification === 'conflict') {
      summary.conflictCount += 1;
    } else {
      summary.errorCount += 1;
    }
  }
}

function addIssue(
  issues: MigrationPreviewIssue[],
  issue: Omit<MigrationPreviewIssue, 'sampleRefs'> & { sampleRefs?: readonly string[] },
): void {
  issues.push({
    ...issue,
    sampleRefs: [...(issue.sampleRefs ?? [])].slice(0, 3),
  });
}

function consolidateIssues(issues: readonly MigrationPreviewIssue[]): MigrationPreviewIssue[] {
  const consolidated = new Map<string, MigrationPreviewIssue>();

  for (const issue of issues) {
    const key = JSON.stringify([
      issue.code,
      issue.domain,
      issue.severity,
      issue.message,
      issue.recovery,
    ]);
    const existing = consolidated.get(key);

    if (!existing) {
      consolidated.set(key, issue);
      continue;
    }

    consolidated.set(key, {
      ...existing,
      count: existing.count + issue.count,
      sampleRefs: [...new Set([...existing.sampleRefs, ...issue.sampleRefs])].slice(0, 3),
    });
  }

  return [...consolidated.values()];
}

function safeReference(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 128) : null;
}

function countReferences(words: readonly unknown[]): WordReferenceIndex {
  const ids = new Map<string, number>();
  const headwords = new Map<string, number>();

  for (const word of words) {
    if (!isRecord(word) || typeof word.word !== 'string' || !word.word.trim()) {
      continue;
    }

    const id = safeReference(word._id);
    const headword = word.word.trim();

    if (id) {
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }

    headwords.set(headword, (headwords.get(headword) ?? 0) + 1);
  }

  return { ids, headwords };
}

function resolveReference(reference: string, index: WordReferenceIndex): number {
  return index.ids.get(reference) ?? index.headwords.get(reference) ?? 0;
}

function analyzeWords(
  data: Record<string, unknown>,
  summary: MigrationDomainSummary,
  issues: MigrationPreviewIssue[],
): { words: readonly unknown[]; references: WordReferenceIndex } {
  if (!Array.isArray(data.db)) {
    const exists = data.db !== undefined;
    applyClassifications(summary, exists ? ['error'] : []);
    addIssue(issues, {
      code: 'WORDS_REQUIRED',
      domain: 'words',
      severity: 'blocking',
      message: '备份缺少可用的 db 词库数组。',
      recovery: '请重新从旧版钟日导出完整备份。',
      count: 1,
    });
    return { words: [], references: { ids: new Map(), headwords: new Map() } };
  }

  const words = data.db;
  const classifications: Classification[] = words.map((word) =>
    isRecord(word) && typeof word.word === 'string' && word.word.trim() ? 'migratable' : 'error',
  );
  const invalidCount = classifications.filter((value) => value === 'error').length;

  if (invalidCount > 0) {
    addIssue(issues, {
      code: 'WORD_RECORD_INVALID',
      domain: 'words',
      severity: 'blocking',
      message: `${invalidCount} 条词汇缺少有效的 word 字段。`,
      recovery: '在旧版中删除或修复损坏词条后重新导出。',
      count: invalidCount,
    });
  }

  const duplicateIndexes = new Map<string, number[]>();
  words.forEach((word, index) => {
    if (!isRecord(word)) {
      return;
    }

    const id = safeReference(word._id);
    if (id) {
      duplicateIndexes.set(id, [...(duplicateIndexes.get(id) ?? []), index]);
    }
  });
  const duplicateGroups = [...duplicateIndexes.entries()].filter(
    ([, indexes]) => indexes.length > 1,
  );
  const duplicateIds = duplicateGroups.map(([id]) => id);

  for (const [, indexes] of duplicateGroups) {
    for (const index of indexes) {
      if (classifications[index] === 'migratable') {
        classifications[index] = 'conflict';
      }
    }
  }

  if (duplicateGroups.length > 0) {
    addIssue(issues, {
      code: 'WORD_ID_DUPLICATE',
      domain: 'words',
      severity: 'blocking',
      message: `${duplicateGroups.length} 组词条重复使用稳定 ID。`,
      recovery: '重复 ID 会破坏关系映射，必须在正式迁移前消解。',
      count: duplicateGroups.length,
      sampleRefs: duplicateIds,
    });
  }

  applyClassifications(summary, classifications);
  return { words, references: countReferences(words) };
}

function analyzeFolders(
  data: Record<string, unknown>,
  summary: MigrationDomainSummary,
  issues: MigrationPreviewIssue[],
): void {
  if (!Array.isArray(data.folders)) {
    const exists = data.folders !== undefined;
    applyClassifications(summary, exists ? ['error'] : []);
    addIssue(issues, {
      code: 'FOLDERS_REQUIRED',
      domain: 'folders',
      severity: 'blocking',
      message: '备份缺少可用的 folders 文件夹数组。',
      recovery: '请重新从旧版钟日导出完整备份。',
      count: 1,
    });
    return;
  }

  const seen = new Set<string>();
  const duplicateNames: string[] = [];
  const classifications = data.folders.map<Classification>((folder) => {
    if (
      typeof folder !== 'string' ||
      !folder.trim() ||
      folder.length > 80 ||
      /[<>]/.test(folder) ||
      [...folder].some((character) => character.charCodeAt(0) <= 31)
    ) {
      return 'error';
    }

    if (seen.has(folder)) {
      duplicateNames.push(folder);
      return 'conflict';
    }

    seen.add(folder);
    return 'migratable';
  });
  const invalidCount = classifications.filter((value) => value === 'error').length;

  if (invalidCount > 0) {
    addIssue(issues, {
      code: 'FOLDER_NAME_INVALID',
      domain: 'folders',
      severity: 'blocking',
      message: `${invalidCount} 个文件夹名称为空、过长或包含不支持字符。`,
      recovery: '请在旧版中重命名这些文件夹后重新导出。',
      count: invalidCount,
    });
  }

  if (duplicateNames.length > 0) {
    addIssue(issues, {
      code: 'FOLDER_DUPLICATE',
      domain: 'folders',
      severity: 'warning',
      message: `${duplicateNames.length} 个文件夹名称重复。`,
      recovery: '正式迁移会结合语言拆分；请检查报告中的重复名称。',
      count: duplicateNames.length,
      sampleRefs: duplicateNames,
    });
  }

  applyClassifications(summary, classifications);
}

function analyzeObjectDomain(
  data: Record<string, unknown>,
  key: string,
  domain: MigrationPreviewDomain,
  summary: MigrationDomainSummary,
  issues: MigrationPreviewIssue[],
  options: {
    validate?: (
      entryKey: string,
      value: unknown,
    ) => { classification: Classification; issue?: Omit<MigrationPreviewIssue, 'sampleRefs'> };
  } = {},
): void {
  const raw = data[key];

  if (raw === undefined || raw === null) {
    summary.notes.push('源备份未包含此数据域。');
    return;
  }

  if (!isRecord(raw)) {
    applyClassifications(summary, ['error']);
    addIssue(issues, {
      code: `${key.toUpperCase()}_TYPE_INVALID`,
      domain,
      severity: 'warning',
      message: `${key} 不是可识别的对象。`,
      recovery: '该域不会进入正式迁移；请检查旧版备份是否完整。',
      count: 1,
    });
    return;
  }

  const classifications: Classification[] = [];
  for (const [entryKey, value] of Object.entries(raw)) {
    const result = options.validate?.(entryKey, value);
    classifications.push(result?.classification ?? 'migratable');
    if (result?.issue) {
      addIssue(issues, { ...result.issue, sampleRefs: [entryKey] });
    }
  }
  applyClassifications(summary, classifications);
}

function analyzeArrayDomain(
  data: Record<string, unknown>,
  key: string,
  domain: MigrationPreviewDomain,
  summary: MigrationDomainSummary,
  issues: MigrationPreviewIssue[],
  options: {
    validate?: (
      value: unknown,
      index: number,
    ) => { classification: Classification; issue?: Omit<MigrationPreviewIssue, 'sampleRefs'> };
  } = {},
): void {
  const raw = data[key];

  if (raw === undefined || raw === null) {
    summary.notes.push('源备份未包含此数据域。');
    return;
  }

  if (!Array.isArray(raw)) {
    applyClassifications(summary, ['error']);
    addIssue(issues, {
      code: `${key.toUpperCase()}_TYPE_INVALID`,
      domain,
      severity: 'warning',
      message: `${key} 不是可识别的数组。`,
      recovery: '该域不会进入正式迁移；请检查旧版备份是否完整。',
      count: 1,
    });
    return;
  }

  const classifications: Classification[] = [];
  raw.forEach((value, index) => {
    const result = options.validate?.(value, index);
    classifications.push(result?.classification ?? 'migratable');
    if (result?.issue) {
      addIssue(issues, { ...result.issue, sampleRefs: [`#${index + 1}`] });
    }
  });
  applyClassifications(summary, classifications);
}

function containsSensitiveApiKey(value: unknown, depth = 0): boolean {
  if (depth > 6 || (!isRecord(value) && !Array.isArray(value))) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveApiKey(item, depth + 1));
  }

  return Object.entries(value).some(
    ([key, nested]) =>
      key.toLowerCase() === 'deepseekapikey' || containsSensitiveApiKey(nested, depth + 1),
  );
}

function analyzeBackup(
  backup: NormalizedBackup,
  previewedAt: Date,
): {
  domains: MigrationDomainSummary[];
  issues: MigrationPreviewIssue[];
} {
  const summaries = new Map(DOMAIN_ORDER.map((domain) => [domain, createSummary(domain)] as const));
  const issues: MigrationPreviewIssue[] = [];
  const summary = (domain: MigrationPreviewDomain) => {
    const value = summaries.get(domain);
    if (!value) {
      throw new Error(`Missing migration preview domain "${domain}"`);
    }
    return value;
  };

  const { references } = analyzeWords(backup.data, summary('words'), issues);
  analyzeFolders(backup.data, summary('folders'), issues);

  analyzeObjectDomain(backup.data, 'wordOverrides', 'overrides', summary('overrides'), issues, {
    validate: (entryKey, value) => {
      if (!isRecord(value)) {
        return {
          classification: 'error',
          issue: {
            code: 'OVERRIDE_RECORD_INVALID',
            domain: 'overrides',
            severity: 'blocking',
            message: '内置词覆盖记录不是可识别对象。',
            recovery: '损坏的 Override 属于 P0 阻断；请修复源数据。',
            count: 1,
          },
        };
      }

      if (resolveReference(entryKey, references) === 0) {
        return {
          classification: 'error',
          issue: {
            code: 'OVERRIDE_WORD_ORPHAN',
            domain: 'overrides',
            severity: 'blocking',
            message: '内置词覆盖找不到对应词条。',
            recovery: '孤立 Override 属于 P0 阻断，不能静默导入。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  analyzeArrayDomain(backup.data, 'stars', 'favorites', summary('favorites'), issues, {
    validate: (value) => {
      const reference = safeReference(value);
      if (!reference) {
        return {
          classification: 'error',
          issue: {
            code: 'FAVORITE_REFERENCE_INVALID',
            domain: 'favorites',
            severity: 'warning',
            message: '收藏包含空值或非字符串引用。',
            recovery: '该收藏会进入隔离报告，不会激活。',
            count: 1,
          },
        };
      }

      const matches = resolveReference(reference, references);
      if (matches === 0) {
        return {
          classification: 'skipped',
          issue: {
            code: 'FAVORITE_WORD_ORPHAN',
            domain: 'favorites',
            severity: 'warning',
            message: '收藏找不到对应词条。',
            recovery: '正式迁移会隔离孤立收藏，不会静默丢弃。',
            count: 1,
          },
        };
      }

      if (matches > 1) {
        return {
          classification: 'conflict',
          issue: {
            code: 'FAVORITE_WORD_AMBIGUOUS',
            domain: 'favorites',
            severity: 'warning',
            message: '收藏按旧名称匹配到多个词条。',
            recovery: '按 Q3 保持多匹配并标记 ambiguous，正式导入前请复核。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  analyzeArrayDomain(backup.data, 'records', 'studyRecords', summary('studyRecords'), issues, {
    validate: (value) =>
      isRecord(value)
        ? { classification: 'migratable' }
        : {
            classification: 'error',
            issue: {
              code: 'STUDY_RECORD_INVALID',
              domain: 'studyRecords',
              severity: 'warning',
              message: '学习记录不是可识别对象。',
              recovery: '损坏记录会进入隔离区，不会伪造成 LearningEvent。',
              count: 1,
            },
          },
  });
  analyzeObjectDomain(backup.data, 'mtWordClears', 'mastery', summary('mastery'), issues);
  analyzeObjectDomain(
    backup.data,
    'mtGroupClears',
    'groupProgress',
    summary('groupProgress'),
    issues,
  );

  analyzeObjectDomain(backup.data, 'fsrsCards', 'fsrsCards', summary('fsrsCards'), issues, {
    validate: (entryKey, value) => {
      if (!isRecord(value)) {
        return {
          classification: 'error',
          issue: {
            code: 'FSRS_CARD_INVALID',
            domain: 'fsrsCards',
            severity: 'blocking',
            message: 'FSRS 卡不是可识别对象。',
            recovery: '损坏的活跃 FSRS 卡属于 P0 阻断。',
            count: 1,
          },
        };
      }

      const keyParts = entryKey.split(':');
      const reference = safeReference(value.wordId) ?? (keyParts.length >= 3 ? keyParts[1] : null);

      if (!reference || resolveReference(reference, references) !== 1) {
        return {
          classification: 'error',
          issue: {
            code: 'FSRS_CARD_WORD_UNRESOLVED',
            domain: 'fsrsCards',
            severity: 'blocking',
            message: 'FSRS 卡无法唯一关联到词条。',
            recovery: '活跃 FSRS 关系孤立属于 P0 阻断，必须先修复映射。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  analyzeArrayDomain(backup.data, 'fsrsReviewLogs', 'fsrsLogs', summary('fsrsLogs'), issues, {
    validate: (value) => {
      if (!isRecord(value)) {
        return {
          classification: 'error',
          issue: {
            code: 'FSRS_LOG_INVALID',
            domain: 'fsrsLogs',
            severity: 'blocking',
            message: 'FSRS 日志不是可识别对象。',
            recovery: '损坏的 FSRS 日志属于 P0 阻断。',
            count: 1,
          },
        };
      }

      const reference = safeReference(value.wordId);
      if (!reference || resolveReference(reference, references) !== 1) {
        return {
          classification: 'error',
          issue: {
            code: 'FSRS_LOG_WORD_UNRESOLVED',
            domain: 'fsrsLogs',
            severity: 'blocking',
            message: 'FSRS 日志无法唯一关联到词条。',
            recovery: 'FSRS 关系孤立属于 P0 阻断，不能激活为新调度。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  analyzeObjectDomain(backup.data, 'wrongBook', 'wrongBook', summary('wrongBook'), issues, {
    validate: (entryKey, value) => {
      if (!isRecord(value)) {
        return {
          classification: 'error',
          issue: {
            code: 'WRONG_BOOK_RECORD_INVALID',
            domain: 'wrongBook',
            severity: 'warning',
            message: '错题记录不是可识别对象。',
            recovery: '损坏记录会进入隔离区。',
            count: 1,
          },
        };
      }

      if (resolveReference(entryKey, references) === 0) {
        return {
          classification: 'skipped',
          issue: {
            code: 'WRONG_BOOK_WORD_ORPHAN',
            domain: 'wrongBook',
            severity: 'warning',
            message: '错题记录找不到对应词条。',
            recovery: '该记录会保留在原始档案，不生成活跃学习事实。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  for (const [key, domain] of [
    ['aiConversations', 'aiConversations'],
    ['aiQuizHistory', 'aiQuizHistory'],
  ] as const) {
    analyzeArrayDomain(backup.data, key, domain, summary(domain), issues, {
      validate: (value) =>
        isRecord(value)
          ? { classification: 'migratable' }
          : {
              classification: 'error',
              issue: {
                code: `${key.toUpperCase()}_RECORD_INVALID`,
                domain,
                severity: 'warning',
                message: `${key} 包含不可识别记录。`,
                recovery: '损坏记录会进入隔离区，不影响其他域的预检。',
                count: 1,
              },
            },
    });
  }

  analyzeArrayDomain(backup.data, 'recycleBin', 'recycleBin', summary('recycleBin'), issues, {
    validate: (value) => {
      if (!isRecord(value)) {
        return {
          classification: 'error',
          issue: {
            code: 'RECYCLE_ITEM_INVALID',
            domain: 'recycleBin',
            severity: 'warning',
            message: '回收站项目不是可识别对象。',
            recovery: '损坏项目会进入隔离区。',
            count: 1,
          },
        };
      }

      const expiresAt = normalizeDate(value.expiresAt);
      if (expiresAt && new Date(expiresAt).getTime() <= previewedAt.getTime()) {
        return {
          classification: 'skipped',
          issue: {
            code: 'RECYCLE_ITEM_EXPIRED',
            domain: 'recycleBin',
            severity: 'info',
            message: '已过期回收站项目只会存档。',
            recovery: '按 Q2 不进入活跃回收站，无需操作。',
            count: 1,
          },
        };
      }

      return { classification: 'migratable' };
    },
  });

  const preferenceEntries = Object.entries(backup.preferences);
  applyClassifications(
    summary('preferences'),
    preferenceEntries.map(([key]) =>
      key.toLowerCase() === 'deepseekapikey' ? 'skipped' : 'migratable',
    ),
  );

  if (
    containsSensitiveApiKey({
      data: backup.data,
      preferences: backup.preferences,
    })
  ) {
    addIssue(issues, {
      code: 'SENSITIVE_API_KEY_REQUIRES_REENTRY',
      domain: 'preferences',
      severity: 'warning',
      message: '检测到旧版 AI API Key 字段；报告未读取或包含其明文。',
      recovery: '按 Q5 不迁移密钥，未来需要 AI 时由用户重新输入。',
      count: 1,
    });
  }

  const unknownDataKeys =
    backup.format === 'modern'
      ? Object.keys(backup.data).filter((key) => !MODERN_DATA_KEYS.has(key))
      : [];
  const unknownCount = backup.unknownTopLevelKeys.length + unknownDataKeys.length;
  applyClassifications(
    summary('unknown'),
    Array.from({ length: unknownCount }, () => 'skipped'),
  );

  if (unknownCount > 0) {
    addIssue(issues, {
      code: 'UNKNOWN_FIELDS_ARCHIVED',
      domain: 'unknown',
      severity: 'info',
      message: `检测到 ${unknownCount} 个规格外字段。`,
      recovery: '未知字段只进入原始档案，不会被静默写入活跃业务域。',
      count: unknownCount,
    });
  }

  if (backup.format === 'legacy-v4') {
    addIssue(issues, {
      code: 'LEGACY_V4_LIMITED_COVERAGE',
      domain: 'unknown',
      severity: 'warning',
      message: '旧 v4 备份不包含完整的现代 FSRS、错题和回收站数据。',
      recovery: '可以继续预检；正式迁移报告会明确标记来源未覆盖的域。',
      count: 1,
    });
  }

  return { domains: DOMAIN_ORDER.map((domain) => summary(domain)), issues };
}

export class MigrationPreviewUseCase {
  constructor(private readonly dependencies: MigrationPreviewDependencies) {}

  async preview(input: PreviewV1BackupInput): Promise<MigrationPreviewReport> {
    if (!input.fileName.trim() || !input.text.trim()) {
      throw new MigrationPreviewInputError('EMPTY_FILE', '备份文件为空，请重新选择。');
    }

    if (input.fileSize > MAX_V1_BACKUP_FILE_SIZE_BYTES) {
      throw new MigrationPreviewInputError(
        'FILE_TOO_LARGE',
        '备份文件超过 25 MB。请确认选择的是钟日 JSON 备份。',
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(input.text);
    } catch {
      throw new MigrationPreviewInputError(
        'INVALID_JSON',
        '无法解析 JSON。请重新从旧版钟日导出备份。',
      );
    }

    const backup = normalizeBackup(raw);
    const previewedAt = this.dependencies.now();
    const [{ domains, issues }, fileDigestSha256] = await Promise.all([
      Promise.resolve(analyzeBackup(backup, previewedAt)),
      this.dependencies.digest.sha256(input.text),
    ]);
    const consolidatedIssues = consolidateIssues(issues);
    const totals = domains.reduce(
      (result, domain) => ({
        source: result.source + domain.sourceCount,
        migratable: result.migratable + domain.migratableCount,
        skipped: result.skipped + domain.skippedCount,
        conflicts: result.conflicts + domain.conflictCount,
        errors: result.errors + domain.errorCount,
      }),
      { source: 0, migratable: 0, skipped: 0, conflicts: 0, errors: 0 },
    );
    const status = consolidatedIssues.some((issue) => issue.severity === 'blocking')
      ? 'blocked'
      : consolidatedIssues.some((issue) => issue.severity === 'warning') ||
          totals.skipped > 0 ||
          totals.conflicts > 0 ||
          totals.errors > 0
        ? 'review'
        : 'ready';

    return MigrationPreviewReportSchema.parse({
      schemaVersion: 1,
      previewedAt: previewedAt.toISOString(),
      status,
      source: {
        fileName: input.fileName.trim(),
        fileSize: input.fileSize,
        fileDigestSha256,
        format: backup.format,
        backupVersion: backup.backupVersion,
        dataSchemaVersion: backup.dataSchemaVersion,
        appName: backup.appName,
        kind: backup.kind,
        exportDate: backup.exportDate,
      },
      totals,
      domains,
      issues: consolidatedIssues,
      assumptions: MIGRATION_ASSUMPTIONS,
      writesPerformed: false,
    });
  }

  serialize(report: MigrationPreviewReport): string {
    return `${JSON.stringify(MigrationPreviewReportSchema.parse(report), null, 2)}\n`;
  }
}
