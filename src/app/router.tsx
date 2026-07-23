import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { UILabPage } from '../pages/UILab';
import { App } from './App';

export const appRoutes: RouteObject[] = [
  {
    path: '/ui-lab',
    element: <UILabPage />,
  },
  {
    path: '*',
    element: <App />,
  },
];

export const router = createBrowserRouter(appRoutes);
