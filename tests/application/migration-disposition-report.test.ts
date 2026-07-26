import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  MigrationDispositionInputError,
  MigrationDispositionReportUseCase,
} from '../../src/application/migration';
import { MigrationDispositionReportSchema } from '../../src/schemas/v1';

const migrationId = `v1-v2:${'a'.repeat(24)}:spec-1`;
const sourceFingerprint = 'b'.repeat(64);
const identityMapDigestSha256 = 'c'.repeat(64);

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

function recordDigest(seed: string): string {
  return createHash('sha256').update(seed).digest('hex');
}

function createInput(
  records: Parameters<MigrationDispositionReportUseCase['create']>[0]['records'],
) {
  return { migrationId, sourceFingerprint, identityMapDigestSha256, records };
}

function createUseCase(
  digestPort: { sha256: (text: string) => Promise<string> } = digest,
): MigrationDispositionReportUseCase {
  return new MigrationDispositionReportUseCase({ digest: digestPort });
}

describe('MigrationDispositionReportUseCase', () => {
  it('conserves migrated, deduped, and quarantined records with deterministic archive refs', async () => {
    const records = [
      {
        sourceRef: 'wordOverrides_v1:orphan',
        domain: 'overrides' as const,
        sourceRecordDigestSha256: recordDigest('override'),
        outcome: 'quarantined' as const,
        severity: 'blocking' as const,
        reasonCode: 'ORPHAN_OVERRIDE',
        quarantineCode: 'OVERRIDE_ORPHAN',
      },
      {
        sourceRef: 'userWords_v1[1]',
        domain: 'words' as const,
        sourceRecordDigestSha256: recordDigest('user-word'),
        outcome: 'migrated' as const,
        severity: 'info' as const,
        reasonCode: 'USER_WORD_MAPPED',
        targetRefs: ['user-v1-word-001'],
      },
      {
        sourceRef: 'myWordDB_v3[0]',
        domain: 'words' as const,
        sourceRecordDigestSha256: recordDigest('duplicate-word'),
        outcome: 'deduped' as const,
        severity: 'warning' as const,
        reasonCode: 'DUPLICATE_CANONICAL_WORD',
        canonicalSourceRef: 'canonical:ja:builtin-ja-core-00005',
        targetRefs: ['builtin-ja-core-00005'],
        rawArchive: true,
      },
      {
        sourceRef: 'starredWords[0]',
        domain: 'favorites' as const,
        sourceRecordDigestSha256: recordDigest('favorite'),
        outcome: 'migrated' as const,
        severity: 'info' as const,
        reasonCode: 'FAVORITE_MAPPED',
        targetRefs: ['builtin-ja-core-00005'],
        rawArchive: true,
      },
    ];

    const first = await createUseCase().create(createInput(records));
    const second = await createUseCase().create(createInput([...records].reverse()));

    expect(MigrationDispositionReportSchema.safeParse(first).success).toBe(true);
    expect(first).toEqual(second);
    expect(first.counts).toEqual({
      source: 4,
      migrated: 2,
      deduped: 1,
      quarantined: 1,
      rawArchived: 2,
    });
    expect(first.entries.map((entry) => entry.sourceRef)).toEqual([
      'myWordDB_v3[0]',
      'starredWords[0]',
      'userWords_v1[1]',
      'wordOverrides_v1:orphan',
    ]);
    expect(first.entries.find((entry) => entry.outcome === 'quarantined')).toMatchObject({
      archiveKind: 'quarantine',
      archiveRef: expect.stringMatching(/^quarantine-v1:[a-f0-9]{64}$/),
      targetRefs: [],
      quarantineCode: 'OVERRIDE_ORPHAN',
    });
    expect(first.entries.filter((entry) => entry.archiveKind === 'rawArchive')).toHaveLength(2);
  });

  it.each([
    {
      name: 'migrated without a target',
      record: {
        sourceRef: 'bad-migrated',
        domain: 'words' as const,
        sourceRecordDigestSha256: recordDigest('bad-migrated'),
        outcome: 'migrated' as const,
        severity: 'info' as const,
        reasonCode: 'BAD',
      },
    },
    {
      name: 'deduped without a canonical source',
      record: {
        sourceRef: 'bad-deduped',
        domain: 'words' as const,
        sourceRecordDigestSha256: recordDigest('bad-deduped'),
        outcome: 'deduped' as const,
        severity: 'warning' as const,
        reasonCode: 'BAD',
        targetRefs: ['target-001'],
      },
    },
    {
      name: 'quarantined with an active target',
      record: {
        sourceRef: 'bad-quarantine',
        domain: 'fsrsCards' as const,
        sourceRecordDigestSha256: recordDigest('bad-quarantine'),
        outcome: 'quarantined' as const,
        severity: 'blocking' as const,
        reasonCode: 'BAD',
        quarantineCode: 'BROKEN_RECORD',
        targetRefs: ['review-card-001'],
      },
    },
    {
      name: 'quarantine with info severity',
      record: {
        sourceRef: 'bad-severity',
        domain: 'preferences' as const,
        sourceRecordDigestSha256: recordDigest('bad-severity'),
        outcome: 'quarantined' as const,
        severity: 'info' as const,
        reasonCode: 'BAD',
        quarantineCode: 'BROKEN_RECORD',
      },
    },
  ])('rejects $name before producing a report', async ({ record }) => {
    await expect(createUseCase().create(createInput([record]))).rejects.toMatchObject({
      code: 'INVALID_DISPOSITION',
    });
  });

  it('rejects duplicate source references before calculating archive digests', async () => {
    let digestCalls = 0;
    const digestPort = {
      sha256: async (text: string) => {
        digestCalls += 1;
        return digest.sha256(text);
      },
    };

    await expect(
      createUseCase(digestPort).create(
        createInput([
          {
            sourceRef: 'duplicate',
            domain: 'words',
            sourceRecordDigestSha256: recordDigest('one'),
            outcome: 'migrated',
            severity: 'info',
            reasonCode: 'MAPPED',
            targetRefs: ['target-001'],
          },
          {
            sourceRef: ' duplicate ',
            domain: 'words',
            sourceRecordDigestSha256: recordDigest('two'),
            outcome: 'migrated',
            severity: 'info',
            reasonCode: 'MAPPED',
            targetRefs: ['target-002'],
          },
        ]),
      ),
    ).rejects.toBeInstanceOf(MigrationDispositionInputError);
    expect(digestCalls).toBe(0);
  });

  it('binds the report to the frozen identity map digest and preserves raw data outside the report', async () => {
    const secret = 'sk-sensitive-should-not-be-here';
    const report = await createUseCase().create(
      createInput([
        {
          sourceRef: 'userWords_v1[0]',
          domain: 'words',
          sourceRecordDigestSha256: recordDigest(secret),
          outcome: 'migrated',
          severity: 'info',
          reasonCode: 'MAPPED',
          targetRefs: ['user-v1-word-001'],
          rawArchive: true,
        },
      ]),
    );

    expect(report.identityMapDigestSha256).toBe(identityMapDigestSha256);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(report.entries[0].archiveRef).toMatch(/^raw-v1:[a-f0-9]{64}$/);
  });

  it('fails closed when the digest adapter returns an invalid value', async () => {
    const invalidDigest = { sha256: async () => 'not-a-sha256' };

    await expect(
      createUseCase(invalidDigest).create(
        createInput([
          {
            sourceRef: 'quarantine-record',
            domain: 'words',
            sourceRecordDigestSha256: recordDigest('quarantine'),
            outcome: 'quarantined',
            severity: 'warning',
            reasonCode: 'BROKEN',
            quarantineCode: 'BROKEN_RECORD',
          },
        ]),
      ),
    ).rejects.toMatchObject({ code: 'DIGEST_FAILED' });
  });
});
