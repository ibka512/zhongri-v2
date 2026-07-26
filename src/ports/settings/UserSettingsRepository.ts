import type { LearnerSettings } from '../../schemas/v1';

/**
 * Local learner settings are facts owned by the v2 application. The port is
 * intentionally separate from the study event repository so settings can be
 * read during startup without coupling the route to learning projections.
 */
export interface UserSettingsRepositoryPort {
  clearUserSettings: (userId: string) => Promise<void>;
  findUserSettings: (userId: string) => Promise<LearnerSettings | null>;
  saveUserSettings: (settings: LearnerSettings) => Promise<LearnerSettings>;
}
