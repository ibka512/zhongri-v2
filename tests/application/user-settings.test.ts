import { describe, expect, it } from 'vitest';

import { UserSettingsUseCase } from '../../src/application/settings';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import { LearnerSettingsSchema } from '../../src/schemas/v1';

describe('UserSettingsUseCase', () => {
  it('validates and persists a completed local learner setup', async () => {
    const repository = new InMemoryStudyPersistence();
    const useCase = new UserSettingsUseCase({
      clock: { now: () => new Date('2026-07-27T01:00:00.000Z') },
      repository,
    });

    const saved = await useCase.save('local-v2-user', {
      audioEnabled: false,
      dailyMinutes: 15,
      focus: 'review',
      language: 'en',
    });

    expect(saved).toEqual(
      LearnerSettingsSchema.parse({
        schemaVersion: 1,
        settingsVersion: 1,
        userId: 'local-v2-user',
        language: 'en',
        dailyMinutes: 15,
        focus: 'review',
        audioEnabled: false,
        setupCompleted: true,
        updatedAt: '2026-07-27T01:00:00.000Z',
      }),
    );
    expect(await useCase.find('local-v2-user')).toEqual(saved);
  });

  it('does not expose another learner settings record after clearing', async () => {
    const repository = new InMemoryStudyPersistence();
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

    await repository.saveUserSettings(settings);
    await repository.clearUserSettings(settings.userId);

    expect(await repository.findUserSettings(settings.userId)).toBeNull();
  });
});
