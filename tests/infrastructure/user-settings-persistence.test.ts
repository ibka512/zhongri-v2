import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { DexieStudyPersistence, InMemoryStudyPersistence } from '../../src/infrastructure/study';
import type { UserSettingsRepositoryPort } from '../../src/ports';
import { LearnerSettingsSchema } from '../../src/schemas/v1';

const settings = LearnerSettingsSchema.parse({
  schemaVersion: 1,
  settingsVersion: 1,
  userId: 'local-v2-user',
  language: 'ja',
  dailyMinutes: 5,
  focus: 'balanced',
  audioEnabled: true,
  setupCompleted: true,
  updatedAt: '2026-07-27T01:00:00.000Z',
});

const databases: DexieStudyPersistence[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()));
});

describe.each([
  {
    name: 'memory',
    create: (): UserSettingsRepositoryPort => new InMemoryStudyPersistence(),
  },
  {
    name: 'dexie',
    create: (): UserSettingsRepositoryPort => {
      const database = new DexieStudyPersistence(`zhongri-v2-settings-${crypto.randomUUID()}`);
      databases.push(database);
      return database;
    },
  },
])('$name settings repository', ({ create }) => {
  it('round-trips and clears the versioned local settings record', async () => {
    const repository = create();

    expect(await repository.findUserSettings(settings.userId)).toBeNull();
    expect(await repository.saveUserSettings(settings)).toEqual(settings);
    expect(await repository.findUserSettings(settings.userId)).toEqual(settings);

    await repository.clearUserSettings(settings.userId);
    expect(await repository.findUserSettings(settings.userId)).toBeNull();
  });
});
