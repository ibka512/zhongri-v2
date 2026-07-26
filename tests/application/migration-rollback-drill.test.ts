import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceStagingUseCase,
  MigrationRollbackDrillUseCase,
  MigrationVerificationUseCase,
  MigrationPreviewUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

async function createStagedMigration() {
  const text = JSON.stringify(createCoreDomainSliceV1Backup(false));
  const now = () => new Date('2026-07-24T05:00:00.000Z');
  const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
    fileName: 'synthetic-rollback-drill-v1.json',
    fileSize: new TextEncoder().encode(text).byteLength,
    text,
  });
  const persistence = new InMemoryMigrationPersistence();
  const staged = await new MigrationDomainSliceStagingUseCase({
    content: new StaticCanonicalContentRepository({
      manifest: jaN5StarterManifest,
      words: jaN5StarterWords,
      digest,
    }),
    digest,
    now,
    persistence,
  }).stage({ report: preview, text });
  return { staged, persistence };
}

describe('MigrationRollbackDrillUseCase', () => {
  it('proves stage, commit and rollback failure injection preserve the migration boundary', async () => {
    const { staged } = await createStagedMigration();
    const evidence = await new MigrationRollbackDrillUseCase({
      createPersistence: () => new InMemoryMigrationPersistence(),
      digest,
      now: () => new Date('2026-07-24T05:01:00.000Z'),
    }).create({ stage: staged.staging });

    expect(evidence.passed).toBe(true);
    expect(evidence.phases.map((phase) => phase.phase)).toEqual(['stage', 'commit', 'rollback']);
    expect(evidence.phases.every((phase) => phase.operationRejected)).toBe(true);
    expect(evidence.phases.every((phase) => phase.passed)).toBe(true);
  });

  it('can satisfy V25 without weakening the other verification checks', async () => {
    const { staged } = await createStagedMigration();
    const evidence = await new MigrationRollbackDrillUseCase({
      createPersistence: () => new InMemoryMigrationPersistence(),
      digest,
      now: () => new Date('2026-07-24T05:01:00.000Z'),
    }).create({ stage: staged.staging });
    const report = await new MigrationVerificationUseCase({
      content: new StaticCanonicalContentRepository({
        manifest: jaN5StarterManifest,
        words: jaN5StarterWords,
        digest,
      }),
      digest,
    }).create({
      source: staged.source,
      slice: staged.slice,
      replaySlice: staged.slice,
      rollbackDrillEvidence: evidence,
    });

    expect(report.checks.find((check) => check.checkId === 'V25')).toMatchObject({
      status: 'passed',
      reasonCode: 'ROLLBACK_DRILL_VERIFIED',
    });
  });
});
