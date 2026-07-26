import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceUseCase,
  MigrationLegacySourceReaderUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { MigrationDomainSliceResultSchema } from '../../src/schemas/v1';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

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
});
