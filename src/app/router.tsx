import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';

import type { StudyUseCase } from '../application/study';
import { StudyDemoPage } from '../pages/StudyDemo';
import { UILabPage } from '../pages/UILab';
import { App } from './App';
import { createStudyDemoUseCase, restartStudyDemoUseCase } from './studyDemo';

export interface AppRouteDependencies {
  createStudyDemoUseCase: () => Promise<StudyUseCase>;
  restartStudyDemoUseCase: () => Promise<StudyUseCase>;
}

const defaultDependencies: AppRouteDependencies = {
  createStudyDemoUseCase,
  restartStudyDemoUseCase,
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
      path: '*',
      element: <App />,
    },
  ];
}

export const appRoutes = createAppRoutes();
export const router = createHashRouter(appRoutes);
