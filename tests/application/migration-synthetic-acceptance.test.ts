import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationActivationUseCase,
  MigrationDomainSliceStagingUseCase,
  MigrationFixedSamplingUseCase,
  MigrationPreviewUseCase,
  MigrationRollbackDrillUseCase,
  MigrationStagedVerificationUseCase,
  MigrationStagingUseCase,
} from '../../src/application/migration';
import { jpStudyCanonicalCorpusManifest, loadJpStudyCanonicalWords } from '../../src/content';
import { StaticCanonicalCorpusContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { createApprovedSyntheticV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

const now = () => new Date('2026-07-27T02:00:00.000Z');

async function createFullCorpusRepository() {
  return new StaticCanonicalCorpusContentRepository({
    manifest: jpStudyCanonicalCorpusManifest,
    words: await loadJpStudyCanonicalWords(),
    digest,
  });
}

describe('approved synthetic migration acceptance', () => {
  it('passes V01–V25 and proves activation plus rollback without touching business tables', async () => {
    const text = JSON.stringify(createApprovedSyntheticV1Backup());
    const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
      fileName: 'approved-synthetic-v1-v10.json',
      fileSize: new TextEncoder().encode(text).byteLength,
      text,
    });
    const persistence = new InMemoryMigrationPersistence();
    const content = await createFullCorpusRepository();
    const staged = await new MigrationDomainSliceStagingUseCase({
      content,
      digest,
      now,
      persistence,
    }).stage({ report: preview, text });

    const samplingEvidence = await new MigrationFixedSamplingUseCase({ digest }).create({
      source: staged.source,
      slice: staged.slice,
    });
    const rollbackDrillEvidence = await new MigrationRollbackDrillUseCase({
      createPersistence: () => new InMemoryMigrationPersistence(),
      digest,
      now,
    }).create({ stage: staged.staging });
    const verification = await new MigrationStagedVerificationUseCase({
      content,
      digest,
      persistence,
    }).verify({
      migrationId: staged.staging.run.migrationId,
      samplingEvidence,
      rollbackDrillEvidence,
    });

    expect(verification.report.passed).toBe(true);
    expect(verification.report.blockingCheckIds).toEqual([]);
    expect(verification.report.checks.every((check) => check.status === 'passed')).toBe(true);
    expect(verification.report.checks.map((check) => check.checkId)).toEqual(
      Array.from({ length: 25 }, (_, index) => `V${String(index + 1).padStart(2, '0')}`),
    );
    expect(verification.report.checks.find((check) => check.checkId === 'V02')).toMatchObject({
      status: 'passed',
      reasonCode: 'CANONICAL_LANGUAGE_COUNTS_MATCH',
    });
    expect(verification.report.checks.find((check) => check.checkId === 'V23')).toMatchObject({
      status: 'passed',
      reasonCode: 'FIXED_SAMPLE_VERIFIED',
    });
    expect(verification.report.checks.find((check) => check.checkId === 'V25')).toMatchObject({
      status: 'passed',
      reasonCode: 'ROLLBACK_DRILL_VERIFIED',
    });
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();

    const activation = await new MigrationActivationUseCase({ persistence, now }).activate({
      migrationId: staged.staging.run.migrationId,
      verificationReport: verification.report,
    });
    expect(activation.status).toBe('committed');
    expect(activation.pointer.activeDatasetId).toBe(staged.staging.dataset.datasetId);
    expect(activation.run.verificationReportDigestSha256).toBe(
      verification.report.reportDigestSha256,
    );

    const rollback = await new MigrationStagingUseCase({ digest, now, persistence }).rollback(
      staged.staging.run.migrationId,
    );
    expect(rollback.status).toBe('rolled-back');
    expect(rollback.pointer.activeDatasetId).toBeNull();
    expect(rollback.run.verificationReportDigestSha256).toBe(
      verification.report.reportDigestSha256,
    );
  }, 15_000);
});
