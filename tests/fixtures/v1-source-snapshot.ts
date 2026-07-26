import type { CaptureMigrationSourceSnapshotInput } from '../../src/application/migration';

import { createModernV1Backup } from './v1-backups';

export function createV1SourceSnapshotInput(
  secret = 'sk-sensitive-fixture-value',
): CaptureMigrationSourceSnapshotInput {
  const backup = createModernV1Backup();
  backup.preferences = { ...backup.preferences, deepseekApiKey: secret };
  const data = backup.data;
  const backupText = JSON.stringify(backup);

  return {
    sourceAppVersion: 'V9.1',
    dataSchemaVersion: 8,
    wordStorageVersion: 1,
    canonicalManifestDigest: 'f'.repeat(64),
    indexedDb: [
      { key: 'userWords_v1', value: data.userWords },
      { key: 'wordOverrides_v1', value: data.wordOverrides },
      { key: 'myWordDB_v3', value: data.db },
      { key: 'wordStorageVersion', value: data.wordStorageVersion },
      { key: 'myFolders_v3', value: data.folders },
      { key: 'myFolderLangs', value: data.folderLangs },
      { key: 'starredWords', value: data.stars },
      { key: 'studyRecords', value: data.records },
      { key: 'mtGroupClears_v3', value: data.mtGroupClears },
      { key: 'mtWordClears_v3', value: data.mtWordClears },
      { key: 'fsrsCards_v1', value: data.fsrsCards },
      { key: 'fsrsReviewLogs_v1', value: data.fsrsReviewLogs },
      { key: 'aiConversations', value: data.aiConversations },
      { key: 'wrongBook_v1', value: data.wrongBook },
      { key: 'aiQuizHistory_v1', value: data.aiQuizHistory },
      { key: 'recycleBin_v1', value: data.recycleBin },
      { key: 'migrationSafetySnapshot_v1', value: { db: data.db, records: data.records } },
      { key: 'preImportRestorePoint_v1', value: backup },
    ],
    localStorage: [
      { key: 'dataSchemaVersion', value: '8' },
      { key: 'theme', value: 'dark' },
      { key: 'langMode', value: 'ja' },
      { key: 'autoSpeak', value: 'true' },
      { key: 'hapticsEnabled', value: 'true' },
      { key: 'showRoots', value: 'true' },
      { key: 'darkBtnStyle', value: 'solid' },
      { key: 'postponeTested', value: 'false' },
      { key: 'wordOrderMode', value: 'weak-first' },
      { key: 'skipMastered', value: 'false' },
      { key: 'useRubyRender', value: 'true' },
      { key: 'ttsEngine', value: 'local' },
      { key: 'displayMode', value: 'all' },
      { key: 'lastCustomGroupTxt', value: '' },
      { key: 'lastCustomGroupVal', value: '' },
      { key: 'lastSelectedFolder', value: '' },
      { key: 'lastTestDisplay', value: 'kana' },
      { key: 'lastTestRange', value: '' },
      { key: 'wrongBookEnabled', value: 'true' },
      { key: 'aiQuizRecord', value: 'true' },
      { key: 'importMode', value: 'manual' },
      { key: 'wordbank_level_ja', value: '' },
      { key: 'wordbank_difficulty_ja', value: '' },
      { key: 'deepseekApiKey', value: secret },
      { key: 'nativeStudyReminderEnabled', value: 'false' },
      { key: 'nativeStudyReminderTime', value: '20:00' },
      {
        key: 'nativeStudyReminderSettingsV2',
        value: JSON.stringify({ enabled: false, time: '20:00' }),
      },
    ],
    selectedBackup: {
      fileName: 'zhongri-v1-backup.json',
      fileSizeBytes: new TextEncoder().encode(backupText).byteLength,
      text: backupText,
    },
  };
}
