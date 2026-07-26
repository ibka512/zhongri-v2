import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationLegacySourceReaderInputError,
  MigrationLegacySourceReaderUseCase,
} from '../../src/application/migration';
import { MigrationLegacySourceSchema } from '../../src/schemas/v1';
import { createLegacyV4Backup, createModernV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

const migrationId = `v1-v2:${'a'.repeat(24)}:spec-1`;
const sourceFingerprint = 'b'.repeat(64);

function createReader(
  digestPort: { sha256: (text: string) => Promise<string> } = digest,
): MigrationLegacySourceReaderUseCase {
  return new MigrationLegacySourceReaderUseCase({ digest: digestPort });
}

function createInput(source: unknown, sourceFileName = 'backup.json') {
  return {
    migrationId,
    sourceFingerprint,
    sourceFileName,
    sanitizedSourceText: JSON.stringify(source),
  };
}

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseObjectKeys);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const entries = Object.entries(value).reverse();
  return Object.fromEntries(entries.map(([key, nested]) => [key, reverseObjectKeys(nested)]));
}

describe('MigrationLegacySourceReaderUseCase', () => {
  it('enumerates modern v10 records into deterministic source references', async () => {
    const source = await createReader().read(createInput(createModernV1Backup()));

    expect(MigrationLegacySourceSchema.safeParse(source).success).toBe(true);
    expect(source.sourceFormat).toBe('modern');
    expect(source.backupVersion).toBe(10);
    expect(source.wordStorageVersion).toBe(1);
    expect(source.records.map((record) => record.sourceRef)).toEqual([
      'data.aiConversations[0]',
      'data.aiQuizHistory[0]',
      'data.db[0]',
      'data.folderLangs["日语基础"]',
      'data.folders[0]',
      'data.fsrsCards["ja:word-1:reading"]',
      'data.fsrsReviewLogs[0]',
      'data.mtGroupClears["日语基础|all|1"]',
      'data.mtWordClears["ja:word-1"]',
      'data.records[0]',
      'data.recycleBin[0]',
      'data.stars[0]',
      'data.wrongBook["word-1"]',
      'preferences["theme"]',
    ]);
    expect(source.counts).toEqual({
      source: 14,
      byDomain: [
        { domain: 'words', count: 1 },
        { domain: 'overrides', count: 0 },
        { domain: 'folders', count: 2 },
        { domain: 'favorites', count: 1 },
        { domain: 'studyRecords', count: 1 },
        { domain: 'mastery', count: 1 },
        { domain: 'groupProgress', count: 1 },
        { domain: 'fsrsCards', count: 1 },
        { domain: 'fsrsLogs', count: 1 },
        { domain: 'wrongBook', count: 1 },
        { domain: 'aiConversations', count: 1 },
        { domain: 'aiQuizHistory', count: 1 },
        { domain: 'recycleBin', count: 1 },
        { domain: 'preferences', count: 1 },
        { domain: 'unknown', count: 0 },
      ],
    });
    expect(source.records.find((record) => record.sourceRef === 'data.db[0]')).toMatchObject({
      domain: 'words',
      sourceValueType: 'object',
      serializedValue: JSON.stringify({
        _id: 'word-1',
        kana: 'ねこ',
        lang: 'ja',
        meaning: '猫',
        word: '猫',
      }),
    });
  });

  it('reads legacy v4 records without inventing modern domains', async () => {
    const source = await createReader().read(createInput(createLegacyV4Backup(), 'legacy.json'));

    expect(source.sourceFormat).toBe('legacy-v4');
    expect(source.backupVersion).toBe(4);
    expect(source.dataSchemaVersion).toBe(0);
    expect(source.records.map((record) => record.sourceRef)).toEqual([
      'data.db[0]',
      'data.folderLangs["旧词库"]',
      'data.folders[0]',
      'data.stars[0]',
      'preferences["theme"]',
    ]);
    expect(source.counts.source).toBe(5);
    expect(source.counts.byDomain.find((item) => item.domain === 'fsrsCards')).toEqual({
      domain: 'fsrsCards',
      count: 0,
    });
  });

  it('keeps semantic reader and record digests stable across JSON key order changes', async () => {
    const first = await createReader().read(createInput(createModernV1Backup()));
    const second = await createReader().read(
      createInput(reverseObjectKeys(createModernV1Backup())),
    );

    expect(second.sourceTextDigestSha256).not.toBe(first.sourceTextDigestSha256);
    expect(second.canonicalSourceDigestSha256).toBe(first.canonicalSourceDigestSha256);
    expect(second.readerDigestSha256).toBe(first.readerDigestSha256);
    expect(second.records).toEqual(first.records);
  });

  it('captures unknown top-level and data fields as archive-only records', async () => {
    const source = createModernV1Backup() as Record<string, unknown>;
    const data = source.data as Record<string, unknown>;
    source.experimental = { enabled: true };
    data.futureDomain = { value: 1 };

    const result = await createReader().read(createInput(source));

    expect(result.unknownSourceRefs).toEqual(['data["futureDomain"]', 'topLevel["experimental"]']);
    expect(result.records.filter((record) => record.domain === 'unknown')).toHaveLength(2);
  });

  it('preserves malformed known domains as records for downstream quarantine', async () => {
    const source = createModernV1Backup() as Record<string, unknown>;
    const data = source.data as Record<string, unknown>;
    data.fsrsCards = 'not-an-object';

    const result = await createReader().read(createInput(source));
    const malformed = result.records.find((record) => record.sourceRef === 'data.fsrsCards');

    expect(malformed).toMatchObject({
      domain: 'fsrsCards',
      sourceValueType: 'string',
      serializedValue: '"not-an-object"',
    });
  });

  it('rejects unsanitized secrets before computing any digest', async () => {
    const source = createModernV1Backup() as Record<string, unknown>;
    source.preferences = { deepseekApiKey: 'sk-sensitive-should-not-leak' };
    let digestCalls = 0;
    const digestPort = {
      sha256: async (text: string) => {
        digestCalls += 1;
        return digest.sha256(text);
      },
    };

    await expect(createReader(digestPort).read(createInput(source))).rejects.toMatchObject({
      code: 'SENSITIVE_VALUE_PRESENT',
    });
    await expect(createReader(digestPort).read(createInput(source))).rejects.not.toThrow(
      'sk-sensitive-should-not-leak',
    );
    expect(digestCalls).toBe(0);
  });

  it.each([
    {
      name: 'empty JSON text',
      input: { ...createInput(createModernV1Backup()), sanitizedSourceText: '  ' },
      code: 'EMPTY_SOURCE',
    },
    {
      name: 'invalid JSON',
      input: { ...createInput(createModernV1Backup()), sanitizedSourceText: '{' },
      code: 'INVALID_JSON',
    },
    {
      name: 'unsupported format',
      input: createInput({ format: 'other', data: {} }),
      code: 'UNKNOWN_FORMAT',
    },
  ])('fails closed for $name', async ({ input, code }) => {
    await expect(createReader().read(input)).rejects.toMatchObject({ code });
  });

  it('fails closed when the digest adapter returns an invalid hash', async () => {
    await expect(
      createReader({ sha256: async () => 'not-a-sha256' }).read(
        createInput(createModernV1Backup()),
      ),
    ).rejects.toBeInstanceOf(MigrationLegacySourceReaderInputError);
    await expect(
      createReader({ sha256: async () => 'not-a-sha256' }).read(
        createInput(createModernV1Backup()),
      ),
    ).rejects.toMatchObject({ code: 'DIGEST_FAILED' });
  });
});
