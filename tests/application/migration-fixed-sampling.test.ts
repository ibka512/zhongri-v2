import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDomainSliceUseCase,
  MigrationFixedSamplingUseCase,
  MigrationLegacySourceReaderUseCase,
  MigrationVerificationUseCase,
} from '../../src/application/migration';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { StaticCanonicalContentRepository } from '../../src/infrastructure/content';
import { createMasteryStudyFsrsDomainSliceV1Backup } from '../fixtures/v1-backups';

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

async function createSourceAndSlice() {
  const source = await new MigrationLegacySourceReaderUseCase({ digest }).read({
    migrationId,
    sourceFingerprint,
    sourceFileName: 'synthetic-fixed-sampling-v1.json',
    sanitizedSourceText: JSON.stringify(createMasteryStudyFsrsDomainSliceV1Backup()),
  });
  const slice = await new MigrationDomainSliceUseCase({
    content: createContentRepository(),
    digest,
  }).create({ source });
  return { source, slice };
}

describe('MigrationFixedSamplingUseCase', () => {
  it('uses sourceFingerprint as a deterministic seed and binds sampled records to payload or archive', async () => {
    const { source, slice } = await createSourceAndSlice();
    const sampler = new MigrationFixedSamplingUseCase({ digest });

    const first = await sampler.create({ source, slice });
    const second = await sampler.create({ source, slice });

    expect(first).toEqual(second);
    expect(first.seedSourceFingerprint).toBe(sourceFingerprint);
    expect(first.categories.map((category) => category.category)).toEqual([
      'builtin-ja',
      'builtin-en',
      'overrides',
      'user-words',
      'related-favorites',
      'related-folders',
      'related-mastery',
      'related-studyRecords',
      'related-groupProgress',
      'related-wrongBook',
      'related-aiConversations',
      'related-aiQuizHistory',
      'related-recycleBin',
      'related-preferences',
      'related-fsrsCards',
      'related-fsrsLogs',
    ]);
    expect(first.passed).toBe(true);
    expect(
      first.categories.find((category) => category.category === 'related-fsrsCards'),
    ).toMatchObject({
      sampleCount: 2,
      passed: true,
    });
  });

  it('can be attached to the V23 verification check without changing other gates', async () => {
    const { source, slice } = await createSourceAndSlice();
    const samplingEvidence = await new MigrationFixedSamplingUseCase({ digest }).create({
      source,
      slice,
    });
    const report = await new MigrationVerificationUseCase({
      content: createContentRepository(),
      digest,
    }).create({ source, slice, replaySlice: slice, samplingEvidence });

    expect(report.checks.find((check) => check.checkId === 'V23')).toMatchObject({
      status: 'passed',
      reasonCode: 'FIXED_SAMPLE_VERIFIED',
    });
    expect(report.checks.find((check) => check.checkId === 'V02')).toMatchObject({
      status: 'unverified',
    });
  });
});
