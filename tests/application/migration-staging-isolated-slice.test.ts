import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceUseCase,
  MigrationLegacySourceReaderUseCase,
  MigrationPreviewUseCase,
  MigrationStagingUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

describe('MigrationStagingUseCase with a core domain slice', () => {
  it('stores the isolated payload without moving the active pointer', async () => {
    const backup = createCoreDomainSliceV1Backup(false);
    const text = JSON.stringify(backup);
    const fileName = 'synthetic-core-domain-v1.json';
    const now = () => new Date('2026-07-24T05:00:00.000Z');
    const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
      fileName,
      fileSize: new TextEncoder().encode(text).byteLength,
      text,
    });
    expect(preview.status).not.toBe('blocked');

    const migrationId = `v1-v2:${preview.source.fileDigestSha256.slice(0, 24)}:spec-1`;
    const source = await new MigrationLegacySourceReaderUseCase({ digest }).read({
      migrationId,
      sourceFingerprint: preview.source.fileDigestSha256,
      sourceFileName: fileName,
      sanitizedSourceText: text,
    });
    const isolatedPayload = (
      await new MigrationDomainSliceUseCase({
        content: new StaticCanonicalContentRepository({
          manifest: jaN5StarterManifest,
          words: jaN5StarterWords,
          digest,
        }),
        digest,
      }).create({ source })
    ).isolatedPayload;
    const persistence = new InMemoryMigrationPersistence();
    const staged = await new MigrationStagingUseCase({ digest, now, persistence }).stage({
      report: preview,
      text,
      isolatedDomainSlice: isolatedPayload,
    });

    const stored = await persistence.findMigrationDataset(staged.run.datasetId);
    expect(stored?.isolatedDomainSlice).toEqual(isolatedPayload);
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
  });
});
