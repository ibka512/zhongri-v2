import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { DexieStudyPersistence } from '../../src/infrastructure/study';
import type { MigrationPersistencePort, StageMigrationInput } from '../../src/ports';
import {
  LearningEventSchema,
  MigrationPreviewReportSchema,
  MigrationRunSchema,
  MigrationStagingDatasetSchema,
} from '../../src/schemas/v1';

const fingerprint = 'a'.repeat(64);
const snapshotDigest = 'b'.repeat(64);
const reportDigest = 'c'.repeat(64);
const migrationId = `v1-v2:${fingerprint.slice(0, 24)}:spec-1`;
const datasetId = `dataset:${migrationId}`;

function createStageInput(): StageMigrationInput {
  const previewReport = MigrationPreviewReportSchema.parse({
    schemaVersion: 1,
    previewedAt: '2026-07-24T05:00:00.000Z',
    status: 'ready',
    source: {
      fileName: 'backup.json',
      fileSize: 2,
      fileDigestSha256: fingerprint,
      format: 'modern',
      backupVersion: 10,
      dataSchemaVersion: 8,
      appName: '钟日',
      kind: 'manual',
      exportDate: null,
    },
    totals: { source: 0, migratable: 0, skipped: 0, conflicts: 0, errors: 0 },
    domains: [
      {
        domain: 'words',
        sourceCount: 0,
        migratableCount: 0,
        skippedCount: 0,
        conflictCount: 0,
        errorCount: 0,
        notes: [],
      },
    ],
    issues: [],
    assumptions: Array.from({ length: 12 }, (_, index) => ({
      id: `Q${index + 1}`,
      decision: `Decision ${index + 1}`,
    })),
    writesPerformed: false,
  });
  const validation = { passed: true, errors: [] } as const;
  const run = MigrationRunSchema.parse({
    schemaVersion: 1,
    migrationId,
    specVersion: 1,
    datasetId,
    sourceFingerprint: fingerprint,
    sourceFileName: 'backup.json',
    sourceFormat: 'modern',
    backupVersion: 10,
    status: 'VALIDATING',
    lastCompletedPhase: 'validation',
    startedAt: '2026-07-24T05:00:00.000Z',
    updatedAt: '2026-07-24T05:00:00.000Z',
    completedAt: null,
    rolledBackAt: null,
    priorActiveDatasetId: null,
    commitMarker: null,
    snapshotDigestSha256: snapshotDigest,
    reportDigestSha256: reportDigest,
    containsRedactedSecrets: false,
    validation,
  });
  const dataset = MigrationStagingDatasetSchema.parse({
    schemaVersion: 1,
    datasetId,
    migrationId,
    sourceFingerprint: fingerprint,
    sanitizedSourceText: '{}',
    snapshotDigestSha256: snapshotDigest,
    reportDigestSha256: reportDigest,
    previewReport,
    validation,
    createdAt: '2026-07-24T05:00:00.000Z',
  });

  return { run, dataset };
}

interface PersistenceHarness {
  persistence: MigrationPersistencePort;
  cleanup: () => Promise<void>;
}

const openDatabases: DexieStudyPersistence[] = [];

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((database) => database.delete()));
});

const harnesses: Array<{ name: string; create: () => PersistenceHarness }> = [
  {
    name: 'memory',
    create: () => ({
      persistence: new InMemoryMigrationPersistence(),
      cleanup: async () => undefined,
    }),
  },
  {
    name: 'dexie',
    create: () => {
      const database = new DexieStudyPersistence(`zhongri-v2-migration-${crypto.randomUUID()}`);
      openDatabases.push(database);
      return {
        persistence: database,
        cleanup: async () => database.close(),
      };
    },
  },
];

describe.each(harnesses)('$name migration persistence contract', ({ create }) => {
  it('stages idempotently, commits by pointer and preserves the dataset after rollback', async () => {
    const { cleanup, persistence } = create();
    const input = createStageInput();

    const staged = await persistence.stageMigration(input);
    const replay = await persistence.stageMigration(input);
    const committed = await persistence.commitMigration({
      migrationId,
      committedAt: '2026-07-24T05:01:00.000Z',
      commitMarker: `${migrationId}:commit`,
    });
    const rolledBack = await persistence.rollbackMigration({
      migrationId,
      rolledBackAt: '2026-07-24T05:02:00.000Z',
      commitMarker: `${migrationId}:rollback`,
    });

    expect(staged.status).toBe('staged');
    expect(replay.status).toBe('replayed');
    expect(committed.pointer.activeDatasetId).toBe(datasetId);
    expect(rolledBack.pointer.activeDatasetId).toBeNull();
    expect(await persistence.findMigrationRun(migrationId)).toMatchObject({
      status: 'ROLLED_BACK',
      priorActiveDatasetId: null,
    });
    expect(await persistence.findMigrationDataset(datasetId)).toEqual(input.dataset);

    const restarted = await persistence.stageMigration(input);
    expect(restarted.status).toBe('staged');
    expect(restarted.run.status).toBe('VALIDATING');

    await cleanup();
  });
});

describe('Dexie migration isolation', () => {
  it('does not modify existing learning events while staging a migration', async () => {
    const database = new DexieStudyPersistence(`zhongri-v2-isolation-${crypto.randomUUID()}`);
    openDatabases.push(database);
    const event = LearningEventSchema.parse({
      schemaVersion: 1,
      id: 'existing-event',
      eventType: 'answerSubmitted',
      timestamp: '2026-07-24T05:00:00.000Z',
      sessionId: 'existing-session',
      userId: 'existing-user',
      itemId: 'item-1',
      questionId: 'question-1',
      payload: {
        answer: 'neko',
        responseTimeMs: 1_000,
      },
    });
    await database.learningEvents.add(event);

    await database.stageMigration(createStageInput());

    expect(await database.learningEvents.get(event.id)).toEqual(event);
    expect(await database.findBySessionId(event.sessionId)).toEqual([event]);
    database.close();
  });
});
