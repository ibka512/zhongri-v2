import { describe, expect, it } from 'vitest';

import {
  MigrationPreviewUseCase,
  MigrationSourceSnapshotUseCase,
  MigrationStagingInputError,
  MigrationStagingUseCase,
} from '../../src/application/migration';
import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { webTextDigest } from '../../src/infrastructure/system';
import { createModernV1Backup } from '../fixtures/v1-backups';
import { createV1SourceSnapshotInput } from '../fixtures/v1-source-snapshot';

function createClock() {
  let timestamp = Date.parse('2026-07-24T05:00:00.000Z');
  return () => {
    const now = new Date(timestamp);
    timestamp += 1_000;
    return now;
  };
}

async function createHarness(value: unknown = createModernV1Backup()) {
  const text = JSON.stringify(value);
  const now = createClock();
  const persistence = new InMemoryMigrationPersistence();
  const previewUseCase = new MigrationPreviewUseCase({ digest: webTextDigest, now });
  const stagingUseCase = new MigrationStagingUseCase({
    digest: webTextDigest,
    now,
    persistence,
  });
  const report = await previewUseCase.preview({
    fileName: 'zhongri-v1-backup.json',
    fileSize: new TextEncoder().encode(text).byteLength,
    text,
  });

  return { persistence, report, stagingUseCase, text };
}

async function createSourceSnapshot(text: string, secret = 'sk-sensitive-value') {
  const input = createV1SourceSnapshotInput(secret);
  input.selectedBackup = {
    fileName: 'zhongri-v1-backup.json',
    fileSizeBytes: new TextEncoder().encode(text).byteLength,
    text,
  };
  return new MigrationSourceSnapshotUseCase({
    digest: webTextDigest,
    now: () => new Date('2026-07-24T05:00:00.000Z'),
  }).capture(input);
}

describe('MigrationStagingUseCase', () => {
  it('persists a redacted source snapshot and derives staging identity from it', async () => {
    const secret = 'sk-sensitive-value';
    const backup = createModernV1Backup();
    backup.preferences = { ...backup.preferences, deepseekApiKey: secret };
    const { persistence, report, stagingUseCase, text } = await createHarness(backup);
    const sourceSnapshot = await createSourceSnapshot(text, secret);

    const result = await stagingUseCase.stage({ report, text, sourceSnapshot });
    const stored = await persistence.findMigrationDataset(result.run.datasetId);

    expect(result.status).toBe('staged');
    expect(result.run.sourceFingerprint).toBe(sourceSnapshot.sourceFingerprint);
    expect(result.run.sourceFingerprint).not.toBe(report.source.fileDigestSha256);
    expect(stored?.sourceSnapshot).toEqual(sourceSnapshot);
    expect(stored?.sanitizedSourceText).toBe(sourceSnapshot.selectedBackup?.sanitizedText);
    expect(stored?.sanitizedSourceText).not.toContain(secret);
    expect(result.run.containsRedactedSecrets).toBe(true);
  });

  it('rejects a source snapshot that does not match the previewed backup', async () => {
    const original = createModernV1Backup();
    const originalText = JSON.stringify(original);
    const sourceSnapshot = await createSourceSnapshot(originalText);
    const changed = createModernV1Backup();
    changed.preferences = { ...changed.preferences, theme: 'light' };
    const { report, stagingUseCase, text } = await createHarness(changed);

    await expect(stagingUseCase.stage({ report, text, sourceSnapshot })).rejects.toMatchObject({
      code: 'SNAPSHOT_MISMATCH',
    });
  });

  it('creates a deterministic safe staging dataset and redacts an old API key', async () => {
    const secret = 'sk-sensitive-value';
    const backup = createModernV1Backup();
    backup.preferences = { ...backup.preferences, deepseekApiKey: secret };
    const { persistence, report, stagingUseCase, text } = await createHarness(backup);

    const result = await stagingUseCase.stage({ report, text });
    const replay = await stagingUseCase.stage({ report, text });
    const stored = await persistence.findMigrationDataset(result.run.datasetId);

    expect(result.status).toBe('staged');
    expect(replay.status).toBe('replayed');
    expect(result.run.migrationId).toBe(
      `v1-v2:${report.source.fileDigestSha256.slice(0, 24)}:spec-1`,
    );
    expect(result.run.containsRedactedSecrets).toBe(true);
    expect(stored?.sanitizedSourceText).not.toContain(secret);
    expect(stored?.sanitizedSourceText).toContain('[REDACTED]');
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
  });

  it('rejects a source that changed after preview', async () => {
    const { report, stagingUseCase } = await createHarness();

    await expect(stagingUseCase.stage({ report, text: '{"changed":true}' })).rejects.toMatchObject({
      code: 'SOURCE_CHANGED',
    });
  });

  it('does not stage a report with blocking relationship errors', async () => {
    const backup = createModernV1Backup();
    backup.data.fsrsCards['ja:missing:meaning'] = { wordId: 'missing' };
    const { report, stagingUseCase, text } = await createHarness(backup);

    expect(report.status).toBe('blocked');
    await expect(stagingUseCase.stage({ report, text })).rejects.toBeInstanceOf(
      MigrationStagingInputError,
    );
  });

  it('atomically commits and rolls back the active dataset pointer', async () => {
    const { persistence, report, stagingUseCase, text } = await createHarness();
    const staged = await stagingUseCase.stage({ report, text });

    const committed = await stagingUseCase.commit(staged.run.migrationId);
    const commitReplay = await stagingUseCase.commit(staged.run.migrationId);
    const rolledBack = await stagingUseCase.rollback(staged.run.migrationId);

    expect(committed.status).toBe('committed');
    expect(commitReplay.status).toBe('replayed');
    expect(committed.pointer.activeDatasetId).toBe(staged.run.datasetId);
    expect(rolledBack.status).toBe('rolled-back');
    expect(rolledBack.pointer.activeDatasetId).toBeNull();
    expect(await persistence.findMigrationDataset(staged.run.datasetId)).not.toBeNull();
  });

  it('keeps the active pointer and staged run unchanged when commit fails', async () => {
    const { persistence, report, stagingUseCase, text } = await createHarness();
    const staged = await stagingUseCase.stage({ report, text });
    persistence.failNextOperation();

    await expect(stagingUseCase.commit(staged.run.migrationId)).rejects.toThrow(
      'Injected migration transaction failure',
    );
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();
    expect(await persistence.findMigrationRun(staged.run.migrationId)).toMatchObject({
      status: 'VALIDATING',
      commitMarker: null,
    });
  });

  it('keeps the committed dataset active when rollback fails', async () => {
    const { persistence, report, stagingUseCase, text } = await createHarness();
    const staged = await stagingUseCase.stage({ report, text });
    await stagingUseCase.commit(staged.run.migrationId);
    persistence.failNextOperation();

    await expect(stagingUseCase.rollback(staged.run.migrationId)).rejects.toThrow(
      'Injected migration transaction failure',
    );
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBe(
      staged.run.datasetId,
    );
    expect(await persistence.findMigrationRun(staged.run.migrationId)).toMatchObject({
      status: 'COMPLETED',
      lastCompletedPhase: 'commit',
    });
  });
});
