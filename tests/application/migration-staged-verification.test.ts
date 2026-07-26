import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceStagingUseCase,
  MigrationFixedSamplingUseCase,
  MigrationPreviewUseCase,
  MigrationRollbackDrillUseCase,
  MigrationStagedVerificationError,
  MigrationStagedVerificationUseCase,
  MigrationStagingUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

const now = () => new Date('2026-07-24T05:00:00.000Z');

function createContentRepository() {
  return new StaticCanonicalContentRepository({
    manifest: jaN5StarterManifest,
    words: jaN5StarterWords,
    digest,
  });
}

async function createStagedMigration() {
  const text = JSON.stringify(createCoreDomainSliceV1Backup(false));
  const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
    fileName: 'synthetic-staged-verification-v1.json',
    fileSize: new TextEncoder().encode(text).byteLength,
    text,
  });
  const persistence = new InMemoryMigrationPersistence();
  const content = createContentRepository();
  const staged = await new MigrationDomainSliceStagingUseCase({
    content,
    digest,
    now,
    persistence,
  }).stage({ report: preview, text });

  return { content, persistence, staged };
}

describe('MigrationStagedVerificationUseCase', () => {
  it('replays the staged source and binds the report to the stored isolated payload', async () => {
    const { content, persistence, staged } = await createStagedMigration();
    const result = await new MigrationStagedVerificationUseCase({
      content,
      digest,
      persistence,
    }).verify({ migrationId: staged.staging.run.migrationId });

    expect(result.dataset.datasetId).toBe(staged.staging.dataset.datasetId);
    expect(result.slice.isolatedPayload.payloadDigestSha256).toBe(
      staged.slice.isolatedPayload.payloadDigestSha256,
    );
    expect(result.report.checks.find((check) => check.checkId === 'V23')).toMatchObject({
      status: 'unverified',
      reasonCode: 'FIXED_SAMPLE_PENDING',
    });
    expect(result.report.checks.find((check) => check.checkId === 'V24')).toMatchObject({
      status: 'passed',
      reasonCode: 'REPLAY_DETERMINISTIC',
    });
    expect(result.report.checks.find((check) => check.checkId === 'V25')).toMatchObject({
      status: 'unverified',
      reasonCode: 'ROLLBACK_DRILL_PENDING',
    });
  });

  it('accepts separately produced sampling and rollback evidence without bypassing unresolved gates', async () => {
    const { content, persistence, staged } = await createStagedMigration();
    const samplingEvidence = await new MigrationFixedSamplingUseCase({ digest }).create({
      source: staged.source,
      slice: staged.slice,
    });
    const rollbackDrillEvidence = await new MigrationRollbackDrillUseCase({
      createPersistence: () => new InMemoryMigrationPersistence(),
      digest,
      now,
    }).create({ stage: staged.staging });

    const result = await new MigrationStagedVerificationUseCase({
      content,
      digest,
      persistence,
    }).verify({
      migrationId: staged.staging.run.migrationId,
      samplingEvidence,
      rollbackDrillEvidence,
    });

    expect(result.report.checks.find((check) => check.checkId === 'V23')).toMatchObject({
      status: 'passed',
      reasonCode: 'FIXED_SAMPLE_VERIFIED',
    });
    expect(result.report.checks.find((check) => check.checkId === 'V25')).toMatchObject({
      status: 'passed',
      reasonCode: 'ROLLBACK_DRILL_VERIFIED',
    });
    expect(result.report.passed).toBe(false);
    expect(result.report.checks.find((check) => check.checkId === 'V02')).toMatchObject({
      status: 'unverified',
      reasonCode: 'BILINGUAL_CORPUS_REQUIRED',
    });
  });

  it('refuses to verify a legacy staging that has no isolated payload', async () => {
    const text = JSON.stringify(createCoreDomainSliceV1Backup(false));
    const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
      fileName: 'synthetic-staged-verification-without-slice-v1.json',
      fileSize: new TextEncoder().encode(text).byteLength,
      text,
    });
    const persistence = new InMemoryMigrationPersistence();
    const staged = await new MigrationStagingUseCase({ digest, now, persistence }).stage({
      report: preview,
      text,
    });

    await expect(
      new MigrationStagedVerificationUseCase({
        content: createContentRepository(),
        digest,
        persistence,
      }).verify({ migrationId: staged.run.migrationId }),
    ).rejects.toMatchObject<MigrationStagedVerificationError>({
      code: 'ISOLATED_DATASET_REQUIRED',
    });
  });
});
