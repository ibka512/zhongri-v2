import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryMigrationPersistence } from '../../src/infrastructure/migration';
import { DexieStudyPersistence } from '../../src/infrastructure/study';
import type {
  MigrationFailureInjectionPort,
  MigrationPersistencePort,
  StageMigrationInput,
} from '../../src/ports';
import {
  LearningEventSchema,
  MigrationIsolatedPayloadSchema,
  MigrationPreviewReportSchema,
  MigrationRunSchema,
  MigrationStagingDatasetSchema,
} from '../../src/schemas/v1';

const fingerprint = 'a'.repeat(64);
const snapshotDigest = 'b'.repeat(64);
const reportDigest = 'c'.repeat(64);
const migrationId = `v1-v2:${fingerprint.slice(0, 24)}:spec-1`;
const datasetId = `dataset:${migrationId}`;

function createStageInput(includeArchive = false): StageMigrationInput {
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
  const isolatedDomainSlice = includeArchive
    ? MigrationIsolatedPayloadSchema.parse({
        schemaVersion: 1,
        stagingKind: 'migration-isolated-domain-slice',
        datasetId,
        migrationId,
        sourceFingerprint: fingerprint,
        sourceReaderDigestSha256: 'd'.repeat(64),
        identityMapDigestSha256: 'e'.repeat(64),
        dispositionReportDigestSha256: 'f'.repeat(64),
        words: [],
        overrides: [],
        folders: [],
        favorites: [],
        archives: [
          {
            schemaVersion: 1,
            archiveRef: `raw-v1:${'1'.repeat(64)}`,
            archiveKind: 'rawArchive',
            sourceRef: 'preferences["theme"]',
            domain: 'preferences',
            sourceRecordDigestSha256: '2'.repeat(64),
            serializedValue: '"dark"',
          },
        ],
        writesPerformed: false,
        activePointerUpdated: false,
        payloadDigestSha256: '3'.repeat(64),
      })
    : null;
  const dataset = MigrationStagingDatasetSchema.parse({
    schemaVersion: 1,
    datasetId,
    migrationId,
    sourceFingerprint: fingerprint,
    sanitizedSourceText: '{}',
    snapshotDigestSha256: snapshotDigest,
    reportDigestSha256: reportDigest,
    previewReport,
    isolatedDomainSlice,
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
    const input = createStageInput(true);

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
    expect(await persistence.findMigrationArchives(migrationId)).toEqual([
      expect.objectContaining({
        archiveRef: `raw-v1:${'1'.repeat(64)}`,
        migrationId,
        datasetId,
        createdAt: '2026-07-24T05:00:00.000Z',
        retentionPolicy: 'stable-version-cycle',
        retentionUntil: null,
        cleanupConfirmedAt: null,
      }),
    ]);

    const restarted = await persistence.stageMigration(input);
    expect(restarted.status).toBe('staged');
    expect(restarted.run.status).toBe('VALIDATING');

    await cleanup();
  });

  it('rolls back every injected write failure without leaving a partial migration', async () => {
    const { cleanup, persistence } = create();
    const input = createStageInput(true);
    const failureInjection = persistence as MigrationFailureInjectionPort;

    failureInjection.failNextOperation();
    await expect(persistence.stageMigration(input)).rejects.toThrow(
      'Injected migration transaction failure',
    );
    expect(await persistence.findMigrationRun(migrationId)).toBeNull();
    expect(await persistence.findMigrationDataset(datasetId)).toBeNull();
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();

    await persistence.stageMigration(input);
    failureInjection.failNextOperation();
    await expect(
      persistence.commitMigration({
        migrationId,
        committedAt: '2026-07-24T05:01:00.000Z',
        commitMarker: `${migrationId}:commit`,
      }),
    ).rejects.toThrow('Injected migration transaction failure');
    expect(await persistence.findMigrationRun(migrationId)).toMatchObject({
      status: 'VALIDATING',
      commitMarker: null,
    });
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBeNull();

    await persistence.commitMigration({
      migrationId,
      committedAt: '2026-07-24T05:02:00.000Z',
      commitMarker: `${migrationId}:commit`,
    });
    failureInjection.failNextOperation();
    await expect(
      persistence.rollbackMigration({
        migrationId,
        rolledBackAt: '2026-07-24T05:03:00.000Z',
        commitMarker: `${migrationId}:rollback`,
      }),
    ).rejects.toThrow('Injected migration transaction failure');
    expect(await persistence.findMigrationRun(migrationId)).toMatchObject({
      status: 'COMPLETED',
      lastCompletedPhase: 'commit',
    });
    expect((await persistence.getActiveMigrationDatasetPointer()).activeDatasetId).toBe(datasetId);

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
