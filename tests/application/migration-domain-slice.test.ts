import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceUseCase,
  MigrationLegacySourceReaderUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { MigrationDomainSliceResultSchema } from '../../src/schemas/v1';
import {
  createCoreDomainSliceV1Backup,
  createMasteryStudyFsrsDomainSliceV1Backup,
} from '../fixtures/v1-backups';

const migrationId = `v1-v2:${'a'.repeat(24)}:spec-1`;
const sourceFingerprint = 'b'.repeat(64);

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

async function createSource() {
  const reader = new MigrationLegacySourceReaderUseCase({ digest });
  return reader.read({
    migrationId,
    sourceFingerprint,
    sourceFileName: 'synthetic-core-domain-v1.json',
    sanitizedSourceText: JSON.stringify(createCoreDomainSliceV1Backup()),
  });
}

function createContentRepository() {
  return new StaticCanonicalContentRepository({
    manifest: jaN5StarterManifest,
    words: jaN5StarterWords,
    digest,
  });
}

describe('MigrationDomainSliceUseCase', () => {
  it('transforms words, overrides, folders, and favorites into isolated staging', async () => {
    const source = await createSource();
    const result = await new MigrationDomainSliceUseCase({
      content: createContentRepository(),
      digest,
    }).create({ source });

    expect(MigrationDomainSliceResultSchema.safeParse(result).success).toBe(true);
    expect(result.identityMap.counts).toEqual({
      source: 4,
      mapped: 3,
      quarantined: 1,
      canonical: 2,
      user: 1,
    });
    expect(result.dispositionReport.counts).toEqual({
      source: 8,
      migrated: 7,
      deduped: 0,
      quarantined: 1,
      rawArchived: 7,
    });
    expect(
      result.dispositionReport.entries.find((entry) => entry.outcome === 'quarantined'),
    ).toMatchObject({
      sourceRef: 'data.wordOverrides["missing-word-001"]',
      domain: 'overrides',
      quarantineCode: 'OVERRIDE_ORPHAN',
      targetRefs: [],
    });
    expect(result.isolatedPayload.words).toHaveLength(2);
    expect(result.isolatedPayload.words).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetWordId: 'builtin-ja-core-00005', targetKind: 'canonical' }),
        expect.objectContaining({ targetWordId: 'user-legacy-001', targetKind: 'user' }),
      ]),
    );
    expect(result.isolatedPayload.overrides).toHaveLength(1);
    expect(result.isolatedPayload.folders).toHaveLength(1);
    expect(result.isolatedPayload.favorites).toHaveLength(2);
    expect(result.isolatedPayload).toMatchObject({
      datasetId: `dataset:${migrationId}`,
      writesPerformed: false,
      activePointerUpdated: false,
      identityMapDigestSha256: result.identityMap.mapDigestSha256,
      dispositionReportDigestSha256: result.dispositionReport.reportDigestSha256,
    });
  });

  it('is deterministic across repeated runs and never calls a persistence port', async () => {
    const source = await createSource();
    const dependencies = { content: createContentRepository(), digest };
    const useCase = new MigrationDomainSliceUseCase(dependencies);
    const first = await useCase.create({ source });
    const second = await useCase.create({ source });

    expect(first).toEqual(second);
    expect(first.isolatedPayload.payloadDigestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.dispositionReport.entries.map((entry) => entry.sourceRef)).toEqual([
      'data.db[0]',
      'data.folderLangs["日语基础"]',
      'data.folders[0]',
      'data.stars[0]',
      'data.stars[1]',
      'data.userWords[0]',
      'data.wordOverrides["builtin-ja-core-00005"]',
      'data.wordOverrides["missing-word-001"]',
    ]);
  });

  it('maps mastery, study events, FSRS cards and logs without activating them', async () => {
    const backup = createMasteryStudyFsrsDomainSliceV1Backup();
    const reader = new MigrationLegacySourceReaderUseCase({ digest });
    const source = await reader.read({
      migrationId,
      sourceFingerprint,
      sourceFileName: 'synthetic-learning-domain-v1.json',
      sanitizedSourceText: JSON.stringify(backup),
    });
    const result = await new MigrationDomainSliceUseCase({
      content: createContentRepository(),
      digest,
    }).create({ source });

    expect(result.isolatedPayload.mastery).toEqual([
      expect.objectContaining({
        targetWordId: 'builtin-ja-core-00005',
        language: 'ja',
        dimensions: { spelling: true, reading: true, listening: false, meaning: false },
        needsReview: true,
      }),
    ]);
    expect(result.isolatedPayload.studyRecords).toHaveLength(3);
    expect(result.isolatedPayload.studyRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: 'DAILY_PUNCH' }),
        expect.objectContaining({ eventType: 'GROUP_COMPLETED', groupLabel: '日语基础' }),
        expect.objectContaining({
          eventType: 'UNKNOWN',
          qualityFlags: ['DATE_INVALID', 'UNKNOWN_TYPE'],
        }),
      ]),
    );
    expect(result.isolatedPayload.groupProgress).toEqual([
      expect.objectContaining({
        groupKey: '日语基础|all|1',
        completionCount: 2,
        qualityFlags: ['COUNT_FLOORED'],
      }),
    ]);
    expect(result.isolatedPayload.fsrsCards).toHaveLength(1);
    expect(result.isolatedPayload.fsrsCards[0]).toMatchObject({
      targetWordId: 'builtin-ja-core-00005',
      dimension: 'meaning',
      algorithm: 'ts-fsrs@v1-adapter',
      due: '2026-07-25T00:00:00.000Z',
    });
    expect(result.isolatedPayload.fsrsLogs).toHaveLength(1);
    expect(result.dispositionReport.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceRef: 'data.fsrsCards["ja:missing-word:meaning"]',
          outcome: 'quarantined',
          quarantineCode: 'RELATION_UNRESOLVED',
        }),
        expect.objectContaining({
          sourceRef: 'data.fsrsReviewLogs[2]',
          outcome: 'quarantined',
          quarantineCode: 'RELATION_UNRESOLVED',
        }),
      ]),
    );
    expect(result.isolatedPayload.writesPerformed).toBe(false);
    expect(result.isolatedPayload.activePointerUpdated).toBe(false);
  });
});
