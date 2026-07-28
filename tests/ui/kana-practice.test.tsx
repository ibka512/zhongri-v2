import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import { KanaPracticePage } from '../../src/pages/KanaPractice';
import type { SpeechSynthesisPort } from '../../src/ports';
import { LearnerSettingsSchema, type LearnerSettings } from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

const savedSettings = LearnerSettingsSchema.parse({
  schemaVersion: 1,
  settingsVersion: 1,
  userId: 'local-v2-user',
  language: 'ja',
  dailyMinutes: 5,
  focus: 'foundations',
  audioEnabled: true,
  setupCompleted: true,
  updatedAt: '2026-07-28T01:00:00.000Z',
});

function createSpeech(supported = true): SpeechSynthesisPort {
  return {
    cancel: vi.fn(),
    speak: vi.fn(async () => undefined),
    supported,
  };
}

function renderPage({
  loadSettings = async () => savedSettings,
  speech = createSpeech(),
}: {
  loadSettings?: () => Promise<LearnerSettings | null>;
  speech?: SpeechSynthesisPort;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/kana',
        element: <KanaPracticePage loadSettings={loadSettings} loadSpeech={() => speech} />,
      },
      { path: '/today', element: <h1>今日学习</h1> },
      { path: '/content', element: <h1>内容中心</h1> },
      { path: '/settings', element: <h1>设置与数据</h1> },
      { path: '/onboarding', element: <h1>首次设置</h1> },
    ],
    { initialEntries: ['/kana'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('KanaPracticePage', () => {
  it('shows the first ten hiragana and gives recognition feedback', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: '平假名，从两行开始' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '基础平假名列表' })).toBeInTheDocument();
    expect(screen.getAllByText('あ')).toHaveLength(2);
    expect(screen.getByText('10 个基础平假名')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回今日学习' })).toHaveAttribute('href', '/today');

    fireEvent.click(screen.getByRole('button', { name: /^う/ }));

    expect(screen.getByText('再看一下：正确答案是 あ（a）。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(screen.getByText('第 2 / 10 题')).toBeInTheDocument();
  });

  it('uses the injected browser speech port for listening mode and shows loading feedback', async () => {
    let resolveSpeech: (() => void) | undefined;
    const speak = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSpeech = resolve;
        }),
    );
    const speech: SpeechSynthesisPort = { cancel: vi.fn(), speak, supported: true };
    renderPage({ speech });

    await screen.findByRole('heading', { name: '平假名，从两行开始' });
    fireEvent.click(screen.getByRole('button', { name: '听辨' }));
    expect(screen.getByRole('heading', { name: '听辨练习' })).toBeInTheDocument();

    const playButton = screen.getByRole('button', { name: '播放：播放 あ 的读音' });
    fireEvent.click(playButton);
    expect(speak).toHaveBeenCalledWith({ language: 'ja-JP', rate: 0.8, text: 'あ' });
    expect(playButton).toBeDisabled();

    resolveSpeech?.();
    await waitFor(() => expect(playButton).not.toBeDisabled());
  });

  it('keeps recognition available when speech is unsupported or disabled in settings', async () => {
    const unsupportedSpeech = createSpeech(false);
    renderPage({ speech: unsupportedSpeech });

    expect(
      await screen.findByText('当前浏览器暂不支持语音朗读。文字辨认仍可继续。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '听辨' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^あ/ })).toBeEnabled();
  });

  it('explains the saved audio preference and links to settings', async () => {
    const disabledSettings = LearnerSettingsSchema.parse({ ...savedSettings, audioEnabled: false });
    renderPage({ loadSettings: async () => disabledSettings });

    expect(await screen.findByText(/声音偏好已关闭/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开设置' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('button', { name: '听辨' })).toBeDisabled();
  });
});

describe('kana route composition', () => {
  it('exposes /kana through the application routes', async () => {
    const speech = createSpeech();
    const router = createMemoryRouter(
      createAppRoutes({
        loadKanaSpeech: () => speech,
        loadUserSettings: async () => savedSettings,
      }),
      { initialEntries: ['/kana'] },
    );

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: '平假名，从两行开始' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/kana');
  });
});
