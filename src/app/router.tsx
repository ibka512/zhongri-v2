import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import type { StudyUseCase } from '../application/study';
import { StudyDemoPage } from '../pages/StudyDemo';
import { UILabPage } from '../pages/UILab';
import { App } from './App';
import { createStudyDemoUseCase } from './studyDemo';

export interface AppRouteDependencies {
  createStudyDemoUseCase: () => Promise<StudyUseCase>;
}

const defaultDependencies: AppRouteDependencies = {
  createStudyDemoUseCase,
};

export function createAppRoutes(
  dependencies: AppRouteDependencies = defaultDependencies,
): RouteObject[] {
  return [
    {
      path: '/study-demo',
      element: <StudyDemoPage createUseCase={dependencies.createStudyDemoUseCase} />,
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
export const router = createBrowserRouter(appRoutes);
