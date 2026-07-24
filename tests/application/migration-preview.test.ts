import { describe, expect, it, vi } from 'vitest';

import {
  MAX_V1_BACKUP_FILE_SIZE_BYTES,
  MigrationPreviewInputError,
  MigrationPreviewUseCase,
} from '../../src/application/migration';
import { MigrationPreviewReportSchema } from '../../src/schemas/v1';
import { createLegacyV4Backup, createModernV1Backup } from '../fixtures/v1-backups';

const digest = 'a'.repeat(64);

function createUseCase() {
  return new MigrationPreviewUseCase({
    digest: {
      sha256: vi.fn().mockResolvedValue(digest),
    },
    now: () => new Date('2026-07-24T04:00:00.000Z'),
  });
}

function createInput(value: unknown, fileName = 'zhongri-backup.json') {
  const text = JSON.stringify(value);
  return {
    fileName,
    fileSize: new TextEncoder().encode(text).byteLength,
    text,
  };
}

describe('MigrationPreviewUseCase', () => {
  it('previews a modern v10 backup without writing data', async () => {
    const report = await createUseCase().preview(createInput(createModernV1Backup()));

    expect(MigrationPreviewReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      status: 'ready',
      writesPerformed: false,
      source: {
        format: 'modern',
        backupVersion: 10,
        dataSchemaVersion: 8,
        fileDigestSha256: digest,
      },
      totals: {
        source: 13,
        migratable: 13,
        skipped: 0,
        conflicts: 0,
        errors: 0,
      },
    });
    expect(report.assumptions).toHaveLength(12);
  });

  it('recognizes legacy v4 and reports its limited coverage', async () => {
    const report = await createUseCase().preview(createInput(createLegacyV4Backup(), 'v4.json'));

    expect(report.status).toBe('review');
    expect(report.source).toMatchObject({
      format: 'legacy-v4',
      backupVersion: 4,
      dataSchemaVersion: 0,
    });
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'LEGACY_V4_LIMITED_COVERAGE',
        severity: 'warning',
      }),
    );
  });

  it('blocks duplicate word ids and orphaned active FSRS records', async () => {
    const backup = createModernV1Backup();
    backup.data.db.push({
      _id: 'word-1',
      lang: 'ja',
      word: '猫咪',
      kana: 'ねこ',
      meaning: '猫',
    });
    backup.data.fsrsCards['ja:missing-word:meaning'] = {
      wordId: 'missing-word',
      due: '2026-07-25T00:00:00.000Z',
    };

    const report = await createUseCase().preview(createInput(backup));

    expect(report.status).toBe('blocked');
    expect(report.totals.conflicts).toBe(3);
    expect(report.totals.errors).toBe(3);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['WORD_ID_DUPLICATE', 'FSRS_CARD_WORD_UNRESOLVED']),
    );
  });

  it('never exposes an old API key in the report or exported JSON', async () => {
    const backup = createModernV1Backup();
    const secret = 'sk-sensitive-value';
    const value = { ...backup, preferences: { ...backup.preferences, deepseekApiKey: secret } };
    const useCase = createUseCase();

    const report = await useCase.preview(createInput(value));
    const exported = useCase.serialize(report);

    expect(report.status).toBe('review');
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'SENSITIVE_API_KEY_REQUIRES_REENTRY',
      }),
    );
    expect(exported).not.toContain(secret);
    expect(exported).not.toContain('deepseekApiKey');
  });

  it('rejects a wrapped modern backup below v5', async () => {
    const backup = { ...createModernV1Backup(), backupVersion: 4 };

    await expect(createUseCase().preview(createInput(backup))).rejects.toMatchObject({
      code: 'UNKNOWN_FORMAT',
    });
  });

  it.each([
    {
      name: 'empty file',
      input: { fileName: 'empty.json', fileSize: 0, text: '' },
      code: 'EMPTY_FILE',
    },
    {
      name: 'oversized file',
      input: {
        fileName: 'large.json',
        fileSize: MAX_V1_BACKUP_FILE_SIZE_BYTES + 1,
        text: '{}',
      },
      code: 'FILE_TOO_LARGE',
    },
    {
      name: 'invalid JSON',
      input: { fileName: 'broken.json', fileSize: 1, text: '{' },
      code: 'INVALID_JSON',
    },
    {
      name: 'unknown backup',
      input: { fileName: 'other.json', fileSize: 2, text: '{}' },
      code: 'UNKNOWN_FORMAT',
    },
  ])('returns a recoverable input error for $name', async ({ code, input }) => {
    const promise = createUseCase().preview(input);

    await expect(promise).rejects.toBeInstanceOf(MigrationPreviewInputError);
    await expect(promise).rejects.toMatchObject({ code });
  });
});
