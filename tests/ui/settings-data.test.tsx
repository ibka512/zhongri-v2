import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import { SettingsDataPage } from '../../src/pages/SettingsData';
import { LearnerSettingsSchema, type LearnerSettings } from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

const savedSettings = LearnerSettingsSchema.parse({
  schemaVersion: 1,
  settingsVersion: 1,
  userId: 'local-v2-user',
  language: 'en',
  dailyMinutes: 10,
  focus: 'review',
  audioEnabled: false,
  setupCompleted: true,
  updatedAt: '2026-07-27T01:00:00.000Z',
});

function renderPage({
  detectLegacyData = async () => 'not-detected' as const,
  loadSettings = async () => savedSettings,
}: {
  detectLegacyData?: () => Promise<'detected' | 'not-detected' | 'unavailable'>;
  loadSettings?: () => Promise<LearnerSettings | null>;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/settings',
        element: (
          <SettingsDataPage detectLegacyData={detectLegacyData} loadSettings={loadSettings} />
        ),
      },
      { path: '/today', element: <h1>今日学习</h1> },
      { path: '/onboarding', element: <h1>首次设置</h1> },
      { path: '/migration-preview', element: <h1>迁移预检</h1> },
    ],
    { initialEntries: ['/settings'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('SettingsDataPage', () => {
  it('shows the saved learner goal and safe migration entry points', async () => {
    renderPage({ detectLegacyData: async () => 'detected' });

    expect(
      await screen.findByRole('heading', { name: '把学习目标和数据边界放在手边' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前目标' })).toBeInTheDocument();
    expect(screen.getByText('英语')).toBeInTheDocument();
    expect(screen.getByText('10 分钟')).toBeInTheDocument();
    expect(screen.getByText('巩固复习')).toBeInTheDocument();
    expect(screen.getByText('暂不使用声音')).toBeInTheDocument();
    expect(screen.getByText('检测到旧版本地来源')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '调整学习目标' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
    expect(screen.getByRole('link', { name: '检查旧版备份' })).toHaveAttribute(
      'href',
      '/migration-preview',
    );
  });

  it('keeps the page usable when settings are missing and legacy detection fails', async () => {
    renderPage({
      detectLegacyData: async () => {
        throw new Error('source unavailable');
      },
      loadSettings: async () => null,
    });

    expect(await screen.findByRole('heading', { name: '还没有完成首次设置' })).toBeInTheDocument();
    expect(screen.getByText('旧版来源暂时无法检测')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入首次设置' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('surfaces a settings read error without blocking recovery', async () => {
    renderPage({
      loadSettings: async () => {
        throw new Error('settings unavailable');
      },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法读取本地设置');
    expect(screen.getByRole('link', { name: '进入首次设置' })).toBeInTheDocument();
  });
});

describe('settings route composition', () => {
  it('exposes /settings from the application routes', async () => {
    const router = createMemoryRouter(
      createAppRoutes({
        detectLegacyV1Data: async () => 'not-detected',
        loadUserSettings: async () => savedSettings,
      }),
      { initialEntries: ['/settings'] },
    );

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: '当前目标' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings');
  });
});
