import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import { jpStudyCanonicalCorpusManifest, jaN5StarterWords } from '../../src/content';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import { ContentCenterPage } from '../../src/pages/ContentCenter';
import {
  CanonicalWordSchema,
  LearnerSettingsSchema,
  type LearnerSettings,
} from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

const savedJapaneseSettings = LearnerSettingsSchema.parse({
  schemaVersion: 1,
  settingsVersion: 1,
  userId: 'local-v2-user',
  language: 'ja',
  dailyMinutes: 5,
  focus: 'balanced',
  audioEnabled: true,
  setupCompleted: true,
  updatedAt: '2026-07-28T01:00:00.000Z',
});

const savedEnglishSettings = LearnerSettingsSchema.parse({
  ...savedJapaneseSettings,
  language: 'en',
});

const englishWord = CanonicalWordSchema.parse({
  schemaVersion: 1,
  id: 'builtin-en-test-001',
  language: 'en',
  headword: 'apple',
  reading: null,
  phonetic: '/ˈæpəl/',
  partOfSpeech: 'noun',
  meaning: '苹果。',
  level: 'CET-4',
  difficulty: 1,
  tags: ['test'],
  isBuiltIn: true,
  dataVersion: 1,
  source: {
    manifestId: 'jp-study-corpus-v1',
    sourceName: 'test',
    sourceVersion: 'test',
  },
});

const repository: CanonicalContentRepositoryPort = {
  getManifest: () => jpStudyCanonicalCorpusManifest,
  listByLanguage: (language) => (language === 'en' ? [englishWord] : jaN5StarterWords),
  findById: (language, wordId) =>
    (language === 'en' ? [englishWord] : jaN5StarterWords).find((word) => word.id === wordId) ??
    null,
  resolveIdentity: () => ({ status: 'not-found' }),
  verifyIntegrity: async () => {
    throw new Error('Integrity verification belongs to the composition root');
  },
};

function renderPage({
  loadContent = async () => repository,
  loadSettings = async () => savedJapaneseSettings,
}: {
  loadContent?: () => Promise<CanonicalContentRepositoryPort>;
  loadSettings?: () => Promise<LearnerSettings | null>;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/content',
        element: <ContentCenterPage loadContent={loadContent} loadSettings={loadSettings} />,
      },
      { path: '/today', element: <h1>今日学习</h1> },
      { path: '/onboarding', element: <h1>首次设置</h1> },
      { path: '/settings', element: <h1>设置与数据</h1> },
    ],
    { initialEntries: ['/content'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('ContentCenterPage', () => {
  it('shows the current language corpus summary and filters read-only words', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: '先看清楚，再开始学习' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '日语词库' })).toBeInTheDocument();
    expect(screen.getByText('5,906')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '元気' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索词形、读音或释义' }), {
      target: { value: '工作' },
    });

    expect(screen.getByRole('heading', { name: '仕事' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '元気' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: '词库等级' }), {
      target: { value: 'N5' },
    });
    expect(screen.getByRole('heading', { name: '仕事' })).toBeInTheDocument();
  });

  it('uses English content when the saved learner language is English', async () => {
    renderPage({ loadSettings: async () => savedEnglishSettings });

    expect(await screen.findByRole('heading', { name: '英语词库' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'apple' })).toBeInTheDocument();
    expect(screen.getByText('/ˈæpəl/')).toBeInTheDocument();
  });

  it('explains the default language when settings are missing and clears empty filters', async () => {
    renderPage({ loadSettings: async () => null });

    expect(await screen.findByText(/当前先展示日语内容/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索词形、读音或释义' }), {
      target: { value: '不存在的词' },
    });
    expect(screen.getByRole('heading', { name: '没有找到匹配词条' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
    expect(screen.getByRole('heading', { name: '元気' })).toBeInTheDocument();
  });

  it('shows a recoverable loading error', async () => {
    const loadContent = vi.fn<() => Promise<CanonicalContentRepositoryPort>>();
    loadContent
      .mockRejectedValueOnce(new Error('content unavailable'))
      .mockResolvedValue(repository);

    renderPage({ loadContent });

    expect(await screen.findByRole('alert')).toHaveTextContent('内容中心暂时无法打开');
    fireEvent.click(screen.getByRole('button', { name: '重新加载内容' }));
    expect(await screen.findByRole('heading', { name: '日语词库' })).toBeInTheDocument();
    expect(loadContent).toHaveBeenCalledTimes(2);
  });
});

describe('content route composition', () => {
  it('exposes /content through the application routes', async () => {
    const router = createMemoryRouter(
      createAppRoutes({
        loadCanonicalContent: async () => repository,
        loadUserSettings: async () => savedJapaneseSettings,
      }),
      { initialEntries: ['/content'] },
    );

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: '日语词库' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/content');
  });
});
