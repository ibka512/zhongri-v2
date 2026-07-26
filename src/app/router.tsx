import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';

import type { PreviewV1BackupInput, StageV1BackupInput } from '../application/migration';
import type { StudyUseCase } from '../application/study';
import { MigrationPreviewPage } from '../pages/MigrationPreview';
import { StudyDemoPage } from '../pages/StudyDemo';
import { TodayCoursePage } from '../pages/TodayCourse';
import { UILabPage } from '../pages/UILab';
import type { MigrationPreviewReport, TodayPlan } from '../schemas/v1';
import type { StageMigrationResult } from '../ports';
import { App } from './App';
import {
  previewV1Backup,
  serializeMigrationPreview,
  stageV1Backup,
  stageV1BackupFromCurrentDevice,
} from './migrationPreview';
import { createStudyDemoUseCase, restartStudyDemoUseCase } from './studyDemo';
import { createTodayCourse, restartTodayCourse, type TodayCourseSession } from './todayCourse';

export interface AppRouteDependencies {
  createTodayCourse: () => Promise<TodayCourseSession>;
  createStudyDemoUseCase: () => Promise<StudyUseCase>;
  previewV1Backup: (input: PreviewV1BackupInput) => Promise<MigrationPreviewReport>;
  restartStudyDemoUseCase: () => Promise<StudyUseCase>;
  restartTodayCourse: (plan: TodayPlan) => Promise<TodayCourseSession>;
  serializeMigrationPreview: (report: MigrationPreviewReport) => string;
  stageV1Backup: (input: StageV1BackupInput) => Promise<StageMigrationResult>;
  stageV1BackupFromCurrentDevice: (input: StageV1BackupInput) => Promise<StageMigrationResult>;
}

const defaultDependencies: AppRouteDependencies = {
  createTodayCourse,
  createStudyDemoUseCase,
  previewV1Backup,
  restartStudyDemoUseCase,
  restartTodayCourse,
  serializeMigrationPreview,
  stageV1Backup,
  stageV1BackupFromCurrentDevice,
};

export function createAppRoutes(dependencies: Partial<AppRouteDependencies> = {}): RouteObject[] {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };

  return [
    {
      path: '/',
      element: <Navigate replace to="/today" />,
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
