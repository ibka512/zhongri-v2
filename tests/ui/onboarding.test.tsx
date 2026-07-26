import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingPage } from '../../src/pages/Onboarding';
import { LearnerSettingsSchema } from '../../src/schemas/v1';
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

function renderOnboarding({
  detectLegacyData = async () => 'not-detected' as const,
  loadSettings = async () => null,
  saveSettings = async () => savedSettings,
}: {
  detectLegacyData?: () => Promise<'detected' | 'not-detected' | 'unavailable'>;
  loadSettings?: () => Promise<typeof savedSettings | null>;
  saveSettings?: () => Promise<typeof savedSettings>;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/onboarding',
        element: (
          <OnboardingPage
            detectLegacyData={detectLegacyData}
            loadSettings={loadSettings}
            saveSettings={saveSettings}
          />
        ),
      },
      { path: '/today', element: <h1>今日学习</h1> },
    ],
    { initialEntries: ['/onboarding'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('OnboardingPage', () => {
  it('guides a new learner through language, goals and the legacy-data notice', async () => {
    const saveSettings = vi.fn(async () => savedSettings);
    renderOnboarding({
      detectLegacyData: async () => 'detected',
      saveSettings,
    });

    expect(
      await screen.findByRole('heading', { name: '先选一门，今天就能开始' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/English/));
    fireEvent.click(screen.getByRole('button', { name: '继续选择英语' }));

    expect(
      await screen.findByRole('heading', { name: '给每天留一小段稳定时间' }),
    ).toBeInTheDocument();
    expect(screen.getByText('检测到旧版本地数据')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('10 分钟'));
    fireEvent.click(screen.getByLabelText(/巩固复习/));
    fireEvent.click(screen.getByLabelText(/保留声音偏好/));
    fireEvent.click(screen.getByRole('button', { name: '保存设置并开始学习' }));

    expect(await screen.findByRole('heading', { name: '今日学习' })).toBeInTheDocument();
    expect(saveSettings).toHaveBeenCalledWith({
      audioEnabled: false,
      dailyMinutes: 10,
      focus: 'review',
      language: 'en',
    });
  });

  it('prefills an existing setup and keeps choices after a save failure', async () => {
    const saveSettings = vi.fn(async () => {
      throw new Error('storage unavailable');
    });
    renderOnboarding({ loadSettings: async () => savedSettings, saveSettings });

    expect(
      await screen.findByRole('heading', { name: '先选一门，今天就能开始' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/English/)).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '继续选择英语' }));
    expect(screen.getByLabelText('10 分钟')).toBeChecked();
    expect(screen.getByLabelText(/巩固复习/)).toBeChecked();
    expect(screen.getByLabelText(/保留声音偏好/)).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '保存设置并开始学习' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('设置保存失败');
    expect(screen.getByLabelText('10 分钟')).toBeChecked();
  });
});
