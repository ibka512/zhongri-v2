import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CaptureV1SourceSnapshotUseCase,
  MigrationSourceSnapshotInputError,
  MigrationSourceSnapshotUseCase,
} from '../../src/application/migration';
import { MigrationSourceSnapshotSchema } from '../../src/schemas/v1';
import { createV1SourceSnapshotInput } from '../fixtures/v1-source-snapshot';

const digest = {
  sha256: async (text: string) => createHash('sha256').update(text).digest('hex'),
};

function createUseCase(timestamp = '2026-07-24T05:00:00.000Z') {
  return new MigrationSourceSnapshotUseCase({
    digest,
    now: () => new Date(timestamp),
  });
}

describe('MigrationSourceSnapshotUseCase', () => {
  it('captures through the read-only source storage port before applying snapshot rules', async () => {
    const input = createV1SourceSnapshotInput();
    let readCount = 0;
    const capture = new CaptureV1SourceSnapshotUseCase({
      sourceStorage: {
        read: async () => {
          readCount += 1;
          return {
            indexedDb: input.indexedDb,
            localStorage: input.localStorage,
            sourceAppVersion: input.sourceAppVersion,
            dataSchemaVersion: input.dataSchemaVersion,
            wordStorageVersion: input.wordStorageVersion,
          };
        },
      },
      snapshot: createUseCase(),
    });

    const snapshot = await capture.capture({
      selectedBackup: input.selectedBackup,
      canonicalManifestDigest: input.canonicalManifestDigest,
    });

    expect(readCount).toBe(1);
    expect(snapshot.sourceFingerprint).toHaveLength(64);
    expect(snapshot.dataSchemaVersion).toBe(8);
    expect(snapshot.wordStorageVersion).toBe(1);
  });

  it('captures real-shaped v1 source keys while redacting sensitive values', async () => {
    const secret = 'sk-sensitive-fixture-value';
    const snapshot = await createUseCase().capture(createV1SourceSnapshotInput(secret));

    expect(MigrationSourceSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      snapshotKind: 'v1-source-snapshot',
      sourceAppVersion: 'V9.1',
      dataSchemaVersion: 8,
      wordStorageVersion: 1,
      sensitiveKeyPresence: [{ key: 'deepseekApiKey', present: true }],
    });
    expect(snapshot.indexedDb).toHaveLength(18);
    expect(snapshot.localStorage).toHaveLength(27);
    expect(snapshot.selectedBackup?.sanitizedText).toContain('[REDACTED]');
    expect(snapshot.selectedBackup?.sanitizedText).not.toContain(secret);
    expect(snapshot.localStorage.find((entry) => entry.key === 'deepseekApiKey')).toMatchObject({
      serializedValue: '"[REDACTED]"',
    });
    expect(JSON.stringify(snapshot)).not.toContain(secret);
  });

  it('produces stable fingerprints independent of key order, capture time, or secret value', async () => {
    const firstInput = createV1SourceSnapshotInput('sk-first-secret');
    const secondInput = createV1SourceSnapshotInput('sk-second-secret');
    secondInput.indexedDb = [...secondInput.indexedDb].reverse();
    secondInput.localStorage = [...secondInput.localStorage].reverse();

    const first = await createUseCase('2026-07-24T05:00:00.000Z').capture(firstInput);
    const second = await createUseCase('2026-07-24T06:00:00.000Z').capture(secondInput);

    expect(second.capturedAt).not.toBe(first.capturedAt);
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint);
    expect(second.snapshotDigestSha256).toBe(first.snapshotDigestSha256);
    expect(second.selectedBackup?.rawDigestSha256).not.toBe(first.selectedBackup?.rawDigestSha256);
  });

  it('changes the source fingerprint when a non-sensitive source value changes', async () => {
    const firstInput = createV1SourceSnapshotInput();
    const secondInput = createV1SourceSnapshotInput();
    secondInput.localStorage = secondInput.localStorage.map((entry) =>
      entry.key === 'langMode' ? { ...entry, value: 'en' } : entry,
    );

    const first = await createUseCase().capture(firstInput);
    const second = await createUseCase().capture(secondInput);

    expect(second.sourceFingerprint).not.toBe(first.sourceFingerprint);
    expect(second.snapshotDigestSha256).not.toBe(first.snapshotDigestSha256);
  });

  it.each([
    {
      name: 'duplicate source key',
      mutate: (input: ReturnType<typeof createV1SourceSnapshotInput>) => {
        input.localStorage = [...input.localStorage, { key: 'theme', value: 'light' }];
      },
      code: 'DUPLICATE_KEY',
    },
    {
      name: 'invalid backup JSON',
      mutate: (input: ReturnType<typeof createV1SourceSnapshotInput>) => {
        input.selectedBackup = {
          fileName: 'broken.json',
          text: '{',
        };
      },
      code: 'INVALID_BACKUP_JSON',
    },
  ])('fails closed for $name', async ({ mutate, code }) => {
    const input = createV1SourceSnapshotInput();
    mutate(input);

    const promise = createUseCase().capture(input);

    await expect(promise).rejects.toBeInstanceOf(MigrationSourceSnapshotInputError);
    await expect(promise).rejects.toMatchObject({ code });
  });
});
