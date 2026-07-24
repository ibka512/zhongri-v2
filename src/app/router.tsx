import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';

import type { PreviewV1BackupInput, StageV1BackupInput } from '../application/migration';
import type { StudyUseCase } from '../application/study';
import { MigrationPreviewPage } from '../pages/MigrationPreview';
import { StudyDemoPage } from '../pages/StudyDemo';
import { UILabPage } from '../pages/UILab';
import type { MigrationPreviewReport } from '../schemas/v1';
import type { StageMigrationResult } from '../ports';
import { App } from './App';
import { previewV1Backup, serializeMigrationPreview, stageV1Backup } from './migrationPreview';
import { createStudyDemoUseCase, restartStudyDemoUseCase } from './studyDemo';

export interface AppRouteDependencies {
  createStudyDemoUseCase: () => Promise<StudyUseCase>;
  previewV1Backup: (input: PreviewV1BackupInput) => Promise<MigrationPreviewReport>;
  restartStudyDemoUseCase: () => Promise<StudyUseCase>;
  serializeMigrationPreview: (report: MigrationPreviewReport) => string;
  stageV1Backup: (input: StageV1BackupInput) => Promise<StageMigrationResult>;
}

const defaultDependencies: AppRouteDependencies = {
  createStudyDemoUseCase,
  previewV1Backup,
  restartStudyDemoUseCase,
  serializeMigrationPreview,
  stageV1Backup,
};

export function createAppRoutes(
  dependencies: AppRouteDependencies = defaultDependencies,
): RouteObject[] {
  return [
    {
      path: '/',
      element: <Navigate replace to="/study-demo" />,
    },
    {
      path: '/study-demo',
      element: (
        <StudyDemoPage
          createUseCase={dependencies.createStudyDemoUseCase}
          restartUseCase={dependencies.restartStudyDemoUseCase}
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
          previewBackup={dependencies.previewV1Backup}
          serializeReport={dependencies.serializeMigrationPreview}
          stageBackup={dependencies.stageV1Backup}
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
