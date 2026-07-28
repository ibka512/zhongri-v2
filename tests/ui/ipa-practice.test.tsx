import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import { englishIpaStarterWordIds, jpStudyCanonicalCorpusManifest } from '../../src/content';
import { IpaPracticePage } from '../../src/pages/IpaPractice';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import {
  CanonicalWordSchema,
  LearnerSettingsSchema,
  type LearnerSettings,
} from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

const savedEnglishSettings = LearnerSettingsSchema.parse({
  schemaVersion: 1,
  settingsVersion: 1,
  userId: 'local-v2-user',
  language: 'en',
  dailyMinutes: 10,
  focus: 'balanced',
  audioEnabled: true,
  setupCompleted: true,
  updatedAt: '2026-07-28T01:00:00.000Z',
});

const savedJapaneseSettings = LearnerSettingsSchema.parse({
  ...savedEnglishSettings,
  language: 'ja',
});

const englishWords = englishIpaStarterWordIds.map((id, index) =>
  CanonicalWordSchema.parse({
    schemaVersion: 1,
    id,
    language: 'en',
    headword: [
      'abandon',
      'ability',
      'abroad',
      'absence',
      'absolute',
      'absorb',
      'abstract',
      'abundant',
      'academic',
      'accelerate',
    ][index],
    reading: null,
    phonetic: [
      '/əˈbændən/',
      '/əˈbɪləti/',
      '/əˈbrɔːd/',
      '/ˈæbsəns/',
      '/ˈæbsəluːt/',
      '/əbˈzɔːb/',
      '/ˈæbstrækt/',
      '/əˈbʌndənt/',
      '/ˌækəˈdemɪk/',
      '/əkˈseləreɪt/',
    ][index],
    partOfSpeech: 'noun',
    meaning: `含义 ${index}`,
    level: 'CET-4',
    difficulty: 1,
    tags: ['starter'],
    isBuiltIn: true,
    dataVersion: 1,
    source: {
      manifestId: 'jp-study-corpus-v1',
      sourceName: 'test',
      sourceVersion: 'test',
    },
  }),
);

const repository: CanonicalContentRepositoryPort = {
  getManifest: () => jpStudyCanonicalCorpusManifest,
  listByLanguage: (language) => (language === 'en' ? englishWords : []),
  findById: (language, wordId) =>
    (language === 'en' ? englishWords : []).find((word) => word.id === wordId) ?? null,
  resolveIdentity: () => ({ status: 'not-found' }),
  verifyIntegrity: async () => {
    throw new Error('Integrity verification belongs to the composition root');
  },
};

function renderPage({
  loadContent = async () => repository,
  loadSettings = async () => savedEnglishSettings,
}: {
  loadContent?: () => Promise<CanonicalContentRepositoryPort>;
  loadSettings?: () => Promise<LearnerSettings | null>;
} = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/ipa',
        element: <IpaPracticePage loadContent={loadContent} loadSettings={loadSettings} />,
      },
      { path: '/today', element: <h1>今日学习</h1> },
      { path: '/content', element: <h1>内容中心</h1> },
      { path: '/kana', element: <h1>五十音</h1> },
      { path: '/settings', element: <h1>设置与数据</h1> },
      { path: '/onboarding', element: <h1>首次设置</h1> },
    ],
    { initialEntries: ['/ipa'] },
  );

  render(
    <ThemeProvider initialTheme="light">
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return router;
}

describe('IpaPracticePage', () => {
  it('shows ten canonical English words and gives IPA recognition feedback', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: '英语音标，从词形到读音' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '英语音标词条' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'abandon' })).toBeInTheDocument();
    expect(screen.getAllByText('/əˈbændən/').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: '返回今日学习' })).toHaveAttribute('href', '/today');

    fireEvent.click(screen.getByRole('button', { name: 'abroad' }));
    expect(screen.getByText('再看一下：正确答案是 abandon（/əˈbændən/）。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(screen.getByText('第 2 / 10 题')).toBeInTheDocument();
  });

  it('switches to word-to-IPA mode and accepts the correct phonetic option', async () => {
    renderPage();

    await screen.findByRole('heading', { name: '英语音标，从词形到读音' });
    fireEvent.click(screen.getByRole('button', { name: '看词形选音标' }));
    expect(screen.getByRole('heading', { name: '看词形选音标' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '/əˈbændən/' }));
    expect(screen.getByText('答对了，这个词形和音标匹配。')).toBeInTheDocument();
  });

  it('shows a non-blocking language notice for Japanese learners', async () => {
    renderPage({ loadSettings: async () => savedJapaneseSettings });
    expect(await screen.findByText(/当前学习语言是日语/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入首次设置' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('shows a non-blocking notice when settings are missing', async () => {
    renderPage({ loadSettings: async () => null });
    expect(await screen.findByText(/还没有保存学习语言/)).toBeInTheDocument();
  });

  it('shows a recoverable content error', async () => {
    const loadContent = vi.fn<() => Promise<CanonicalContentRepositoryPort>>();
    loadContent
      .mockRejectedValueOnce(new Error('content unavailable'))
      .mockResolvedValue(repository);
    renderPage({ loadContent });

    expect(await screen.findByRole('alert')).toHaveTextContent('英语音标内容暂时无法打开');
    fireEvent.click(screen.getByRole('button', { name: '重新加载英语音标' }));
    expect(await screen.findByRole('heading', { name: 'abandon' })).toBeInTheDocument();
    expect(loadContent).toHaveBeenCalledTimes(2);
  });
});

describe('ipa route composition', () => {
  it('exposes /ipa through the application routes', async () => {
    const router = createMemoryRouter(
      createAppRoutes({
        loadCanonicalContent: async () => repository,
        loadUserSettings: async () => savedEnglishSettings,
      }),
      { initialEntries: ['/ipa'] },
    );

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '英语音标，从词形到读音' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ipa');
  });
});
