import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceUseCase,
  MigrationLegacySourceReaderUseCase,
  MigrationVerificationUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { MigrationVerificationReportSchema } from '../../src/schemas/v1';
import { createCoreDomainSliceV1Backup } from '../fixtures/v1-backups';

const migrationId = `v1-v2:${'a'.repeat(24)}:spec-1`;
const sourceFingerprint = 'b'.repeat(64);
const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

function createContentRepository() {
  return new StaticCanonicalContentRepository({
    manifest: jaN5StarterManifest,
    words: jaN5StarterWords,
    digest,
  });
}

async function createSource(backup = createCoreDomainSliceV1Backup(false)) {
  return new MigrationLegacySourceReaderUseCase({ digest }).read({
    migrationId,
    sourceFingerprint,
    sourceFileName: 'synthetic-verification-v1.json',
    sanitizedSourceText: JSON.stringify(backup),
  });
}

async function createSlice(source: Awaited<ReturnType<typeof createSource>>) {
  return new MigrationDomainSliceUseCase({
    content: createContentRepository(),
    digest,
  }).create({ source });
}

describe('MigrationVerificationUseCase', () => {
  it('passes isolated invariants and keeps unresolved acceptance gates explicit', async () => {
    const source = await createSource();
    const first = await createSlice(source);
    const second = await createSlice(source);
    const report = await new MigrationVerificationUseCase({
      content: createContentRepository(),
      digest,
    }).create({ source, slice: first, replaySlice: second });

    expect(MigrationVerificationReportSchema.safeParse(report).success).toBe(true);
    expect(report.checks.map((check) => check.checkId)).toEqual(
      Array.from({ length: 25 }, (_, index) => `V${String(index + 1).padStart(2, '0')}`),
    );
    expect(
      report.checks.filter((check) => check.status === 'passed').map((check) => check.checkId),
    ).toEqual(
      expect.arrayContaining([
        'V01',
        'V03',
        'V04',
        'V05',
        'V06',
        'V07',
        'V08',
        'V09',
        'V10',
        'V11',
        'V12',
        'V13',
        'V14',
        'V15',
        'V16',
        'V17',
        'V19',
        'V20',
        'V21',
        'V22',
        'V24',
      ]),
    );
    expect(report.checks.find((check) => check.checkId === 'V02')).toMatchObject({
      status: 'unverified',
      reasonCode: 'BILINGUAL_CORPUS_REQUIRED',
    });
    expect(report.checks.find((check) => check.checkId === 'V25')).toMatchObject({
      status: 'unverified',
      severity: 'blocking',
    });
    expect(report.passed).toBe(false);
    expect(report.reportDigestSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not call unknown source records conserved before archive-only validation exists', async () => {
    const backup = createCoreDomainSliceV1Backup(false);
    backup.data.unknownFutureDomain = { enabled: true };
    const source = await createSource(backup);
    const slice = await createSlice(source);
    const report = await new MigrationVerificationUseCase({
      content: createContentRepository(),
      digest,
    }).create({ source, slice });

    expect(report.checks.find((check) => check.checkId === 'V21')).toMatchObject({
      status: 'unverified',
      reasonCode: 'UNKNOWN_SOURCE_RECORDS_PENDING',
    });
  });
});
