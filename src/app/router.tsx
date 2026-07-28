import { createHashRouter, type RouteObject } from 'react-router-dom';

import type { PreviewV1BackupInput, StageV1BackupInput } from '../application/migration';
import type { SaveLearnerSettingsInput } from '../application/settings';
import type { StudyUseCase } from '../application/study';
import { OnboardingPage } from '../pages/Onboarding';
import { MigrationPreviewPage } from '../pages/MigrationPreview';
import { LaunchPage } from '../pages/Launch';
import { StudyDemoPage } from '../pages/StudyDemo';
import { SettingsDataPage } from '../pages/SettingsData';
import { ContentCenterPage } from '../pages/ContentCenter';
import { TodayCoursePage } from '../pages/TodayCourse';
import { UILabPage } from '../pages/UILab';
import type { MigrationPreviewReport, TodayPlan } from '../schemas/v1';
import type { StageMigrationResult } from '../ports';
import { App } from './App';
import { createCanonicalContentRepository } from './content';
import {
  previewV1Backup,
  serializeMigrationPreview,
  stageV1Backup,
  stageV1BackupFromCurrentDevice,
} from './migrationPreview';
import { detectLegacyV1Data, loadUserSettings, saveUserSettings } from './settings';
import { createStudyDemoUseCase, restartStudyDemoUseCase } from './studyDemo';
import { createTodayCourse, restartTodayCourse, type TodayCourseSession } from './todayCourse';

export interface AppRouteDependencies {
  loadCanonicalContent: typeof createCanonicalContentRepository;
  createTodayCourse: () => Promise<TodayCourseSession>;
  createStudyDemoUseCase: () => Promise<StudyUseCase>;
  detectLegacyV1Data: typeof detectLegacyV1Data;
  loadUserSettings: typeof loadUserSettings;
  previewV1Backup: (input: PreviewV1BackupInput) => Promise<MigrationPreviewReport>;
  restartStudyDemoUseCase: () => Promise<StudyUseCase>;
  restartTodayCourse: (plan: TodayPlan) => Promise<TodayCourseSession>;
  saveUserSettings: (input: SaveLearnerSettingsInput) => ReturnType<typeof saveUserSettings>;
  serializeMigrationPreview: (report: MigrationPreviewReport) => string;
  stageV1Backup: (input: StageV1BackupInput) => Promise<StageMigrationResult>;
  stageV1BackupFromCurrentDevice: (input: StageV1BackupInput) => Promise<StageMigrationResult>;
}

const defaultDependencies: AppRouteDependencies = {
  loadCanonicalContent: createCanonicalContentRepository,
  createTodayCourse,
  createStudyDemoUseCase,
  detectLegacyV1Data,
  loadUserSettings,
  previewV1Backup,
  restartStudyDemoUseCase,
  restartTodayCourse,
  saveUserSettings,
  serializeMigrationPreview,
  stageV1Backup,
  stageV1BackupFromCurrentDevice,
};

export function createAppRoutes(dependencies: Partial<AppRouteDependencies> = {}): RouteObject[] {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };

  return [
    {
      path: '/',
      element: <LaunchPage loadSettings={resolvedDependencies.loadUserSettings} />,
    },
    {
      path: '/onboarding',
      element: (
        <OnboardingPage
          detectLegacyData={resolvedDependencies.detectLegacyV1Data}
          loadSettings={resolvedDependencies.loadUserSettings}
          saveSettings={resolvedDependencies.saveUserSettings}
        />
      ),
    },
    {
      path: '/today',
      element: (
        <TodayCoursePage
          createCourse={resolvedDependencies.createTodayCourse}
          restartCourse={resolvedDependencies.restartTodayCourse}
        />
      ),
    },
    {
      path: '/settings',
      element: (
        <SettingsDataPage
          detectLegacyData={resolvedDependencies.detectLegacyV1Data}
          loadSettings={resolvedDependencies.loadUserSettings}
        />
      ),
    },
    {
      path: '/content',
      element: (
        <ContentCenterPage
          loadContent={resolvedDependencies.loadCanonicalContent}
          loadSettings={resolvedDependencies.loadUserSettings}
        />
      ),
    },
    {
      path: '/study-demo',
      element: (
        <StudyDemoPage
          createUseCase={resolvedDependencies.createStudyDemoUseCase}
          restartUseCase={resolvedDependencies.restartStudyDemoUseCase}
        />
      ),
    },
    {
      path: '/ui-lab',
      element: <UILabPage />,
    },
    {
      path: '/migration-preview',
      element: (
        <MigrationPreviewPage
          previewBackup={resolvedDependencies.previewV1Backup}
          serializeReport={resolvedDependencies.serializeMigrationPreview}
          stageBackup={resolvedDependencies.stageV1Backup}
          stageDeviceBackup={resolvedDependencies.stageV1BackupFromCurrentDevice}
        />
      ),
    },
    {
      path: '*',
      element: <App />,
    },
  ];
}

export const appRoutes = createAppRoutes();
export const router = createHashRouter(appRoutes);
