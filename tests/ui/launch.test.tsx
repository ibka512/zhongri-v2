import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LaunchPage } from '../../src/pages/Launch';
import { LearnerSettingsSchema } from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

function renderLaunch(
  loadSettings: () => Promise<ReturnType<typeof LearnerSettingsSchema.parse> | null>,
) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LaunchPage loadSettings={loadSettings} /> },
      { path: '/onboarding', element: <h1>首次设置</h1> },
      { path: '/today', element: <h1>今日学习</h1> },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('LaunchPage', () => {
  it('sends a new learner to first setup', async () => {
    const router = renderLaunch(async () => null);

    expect(await screen.findByRole('heading', { name: '首次设置' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('sends a completed learner to today course', async () => {
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
    const router = renderLaunch(async () => settings);

    expect(await screen.findByRole('heading', { name: '今日学习' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/today');
  });
});
