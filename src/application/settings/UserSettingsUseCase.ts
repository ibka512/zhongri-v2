import type { ClockPort, UserSettingsRepositoryPort } from '../../ports';
import {
  LearnerSettingsDailyMinutesSchema,
  LearnerSettingsFocusSchema,
  LearnerSettingsSchema,
  type Language,
  type LearnerSettings,
  type LearnerSettingsDailyMinutes,
  type LearnerSettingsFocus,
} from '../../schemas/v1';

export interface SaveLearnerSettingsInput {
  audioEnabled: boolean;
  dailyMinutes: LearnerSettingsDailyMinutes;
  focus: LearnerSettingsFocus;
  language: Language;
}

export interface UserSettingsUseCaseDependencies {
  clock: ClockPort;
  repository: UserSettingsRepositoryPort;
}

/**
 * Owns the versioned local learner settings boundary used by startup and the
 * onboarding form. It validates the form value before handing it to storage.
 */
export class UserSettingsUseCase {
  constructor(private readonly dependencies: UserSettingsUseCaseDependencies) {}

  find(userId: string): Promise<LearnerSettings | null> {
    return this.dependencies.repository.findUserSettings(userId);
  }

  async save(userId: string, input: SaveLearnerSettingsInput): Promise<LearnerSettings> {
    const parsed = LearnerSettingsSchema.parse({
      schemaVersion: 1,
      settingsVersion: 1,
      userId,
      language: input.language,
      dailyMinutes: LearnerSettingsDailyMinutesSchema.parse(input.dailyMinutes),
      focus: LearnerSettingsFocusSchema.parse(input.focus),
      audioEnabled: input.audioEnabled,
      setupCompleted: true,
      updatedAt: this.dependencies.clock.now().toISOString(),
    });

    return this.dependencies.repository.saveUserSettings(parsed);
  }
}
