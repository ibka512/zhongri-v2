import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationActivationBlockedError,
  MigrationActivationUseCase,
  MigrationDomainSliceStagingUseCase,
  MigrationPreviewUseCase,
  MigrationVerificationUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { MigrationVerificationReportSchema } from '../../src/schemas/v1';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

async function createStagedMigration() {
  const backup = createCoreDomainSliceV1Backup(false);
  const text = JSON.stringify(backup);
  const now = () => new Date('2026-07-24T05:00:00.000Z');
  const preview = await new MigrationPreviewUseCase({ digest, now }).preview({
    fileName: 'synthetic-activation-v1.json',
    fileSize: new TextEncoder().encode(text).byteLength,
    text,
  });
  const persistence = new InMemoryMigrationPersistence();
  const staging = await new MigrationDomainSliceStagingUseCase({
    content: new StaticCanonicalContentRepository({
      manifest: jaN5StarterManifest,
      words: jaN5StarterWords,
      digest,
    }),
    digest,
    now,
    persistence,
  }).stage({ report: preview, text });
  const verificationReport = await new MigrationVerificationUseCase({
    content: new StaticCanonicalContentRepository({
      manifest: jaN5StarterManifest,
      words: jaN5StarterWords,
      digest,
    }),
    digest,
  }).create({ source: staging.source, slice: staging.slice, replaySlice: staging.slice });

  return { persistence, staging, verificationReport };
}

describe('MigrationActivationUseCase', () => {
  it('blocks activation until every V01–V25 check has passed', async () => {
    const { persistence, staging, verificationReport } = await createStagedMigration();
    const activation = new MigrationActivationUseCase({
      persistence,
      now: () => new Date('2026-07-24T05:01:00.000Z'),
    });

    await expect(
      activation.activate({
        migrationId: staging.staging.run.migrationId,
        verificationReport,
      }),
    ).rejects.toMatchObject<Partial<MigrationActivationBlockedError>>({
      code: 'VERIFICATION_FAILED',
    });
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
  });

  it('commits only an isolated dataset and records the verification digest after the gate passes', async () => {
    const { persistence, staging, verificationReport } = await createStagedMigration();
    const verificationReportForMechanicsOnly = MigrationVerificationReportSchema.parse({
      ...verificationReport,
      checks: verificationReport.checks.map((check) => ({
        ...check,
        status: 'passed',
        severity: 'info',
        reasonCode: 'TEST_GATE_OVERRIDE',
        message: 'synthetic all-pass report used only to exercise activation mechanics',
        expected: null,
        observed: null,
      })),
      passed: true,
      blockingCheckIds: [],
      reportDigestSha256: 'd'.repeat(64),
    });
    const activation = new MigrationActivationUseCase({
      persistence,
      now: () => new Date('2026-07-24T05:01:00.000Z'),
    });

    const committed = await activation.activate({
      migrationId: staging.staging.run.migrationId,
      verificationReport: verificationReportForMechanicsOnly,
    });

    expect(committed.status).toBe('committed');
    expect(committed.pointer.activeDatasetId).toBe(staging.staging.run.datasetId);
    expect(committed.run.verificationReportDigestSha256).toBe('d'.repeat(64));
    expect(committed.run.commitMarker).toContain('d'.repeat(64));
  });
});
