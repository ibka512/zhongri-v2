import {
  UserSettingsUseCase,
  type SaveLearnerSettingsInput,
  type LegacyV1DataStatus,
} from '../application/settings';
import { BrowserV1SourceStorage } from '../infrastructure/migration';
import { webClock } from '../infrastructure/system';
import type { LearnerSettings } from '../schemas/v1';
import { appPersistence } from './persistence';
import { localUserId } from './user';

const userSettingsUseCase = new UserSettingsUseCase({
  clock: webClock,
  repository: appPersistence,
});

const legacyV1Markers = [
  'dataschemaversion',
  'wordstorageversion',
  'words',
  'myworddb',
  'preferences',
  'studyrecords',
  'fscards',
  'fsrscards',
  'fsrslogs',
  'folders',
  'favorites',
  'wrongbook',
  'aiconversations',
  'aiquizhistory',
  'nativestudyreminder',
] as const;

function looksLikeLegacyV1Key(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return legacyV1Markers.some((marker) => normalized.includes(marker));
}

export function loadUserSettings(): Promise<LearnerSettings | null> {
  return userSettingsUseCase.find(localUserId);
}

export function saveUserSettings(input: SaveLearnerSettingsInput): Promise<LearnerSettings> {
  return userSettingsUseCase.save(localUserId, input);
}

/**
 * The onboarding notice is intentionally a read-only hint. It does not create
 * a migration snapshot or write to the legacy database.
 */
export async function detectLegacyV1Data(): Promise<LegacyV1DataStatus> {
  try {
    const source = await new BrowserV1SourceStorage().read();
    const hasIndexedDbData = source.indexedDb.length > 0;
    const hasLegacyLocalStorageData = source.localStorage.some((entry) =>
      looksLikeLegacyV1Key(entry.key),
    );

    return hasIndexedDbData || hasLegacyLocalStorageData ? 'detected' : 'not-detected';
  } catch {
    return 'unavailable';
  }
}
