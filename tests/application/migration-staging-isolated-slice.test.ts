import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceStagingUseCase,
  MigrationPreviewUseCase,
  MigrationSourceSnapshotUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';
import { createV1SourceSnapshotInput } from '../fixtures/v1-source-snapshot';

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

    const persistence = new InMemoryMigrationPersistence();
    const orchestrator = new MigrationDomainSliceStagingUseCase({
      content: new StaticCanonicalContentRepository({
        manifest: jaN5StarterManifest,
        words: jaN5StarterWords,
        digest,
      }),
      digest,
      now,
      persistence,
    });
    const staged = await orchestrator.stage({
      report: preview,
      text,
    });
    const replay = await orchestrator.stage({ report: preview, text });

    const stored = await persistence.findMigrationDataset(staged.staging.run.datasetId);
    expect(staged.staging.status).toBe('staged');
    expect(replay.staging.status).toBe('replayed');
    expect(stored?.isolatedDomainSlice).toEqual(staged.slice.isolatedPayload);
    expect(staged.slice.dispositionReport.counts.quarantined).toBe(0);
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
  });

  it('passes an explicit device snapshot through the reader before staging', async () => {
    const snapshotInput = createV1SourceSnapshotInput();
    const text = snapshotInput.selectedBackup?.text ?? '{}';
    const fileName = snapshotInput.selectedBackup?.fileName ?? 'device-audit.json';
    const now = () => new Date('2026-07-24T05:00:00.000Z');
    const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
      fileName,
      fileSize: new TextEncoder().encode(text).byteLength,
      text,
    });
    const sourceSnapshot = await new MigrationSourceSnapshotUseCase({ digest, now }).capture(
      snapshotInput,
    );
    const persistence = new InMemoryMigrationPersistence();
    const orchestrator = new MigrationDomainSliceStagingUseCase({
      content: new StaticCanonicalContentRepository({
        manifest: jaN5StarterManifest,
        words: jaN5StarterWords,
        digest,
      }),
      digest,
      now,
      persistence,
    });

    const staged = await orchestrator.stage({
      report: preview,
      text,
      sourceSnapshot,
      sourceSelection: 'device',
    });

    expect(staged.source.sourceOrigin).toBe('device');
    expect(staged.source.sourceFingerprint).toBe(sourceSnapshot.sourceFingerprint);
    expect(staged.staging.dataset.sourceSnapshot).toEqual(sourceSnapshot);
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
  });
});
