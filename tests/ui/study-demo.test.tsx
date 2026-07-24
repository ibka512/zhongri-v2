import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import { StudyUseCase } from '../../src/application/study';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import { studyDemoItems } from '../../src/mock/questions';
import { StudyDemoPage } from '../../src/pages/StudyDemo';
import { ThemeProvider } from '../../src/ui/theme';

function createHarness() {
  const persistence = new InMemoryStudyPersistence();
  let id = 0;
  let timestamp = Date.parse('2026-07-24T01:00:00.000Z');
  const createUseCase = () =>
    StudyUseCase.startOrResume(
      {
        items: studyDemoItems,
        sessionId: 'ui-test-session',
        userId: 'ui-test-user',
      },
      {
        clock: {
          now: () => {
            const now = new Date(timestamp);
            timestamp += 1_000;
            return now;
          },
        },
        idGenerator: {
          nextId: () => {
            id += 1;
            return `ui-event-${id}`;
          },
        },
        persistence,
      },
    );

  return { createUseCase, persistence };
}

describe('StudyDemoPage', () => {
  it('completes three mock questions with correct and incorrect feedback', async () => {
    const { createUseCase } = createHarness();
    const router = createMemoryRouter(createAppRoutes({ createStudyDemoUseCase: createUseCase }), {
      initialEntries: ['/study-demo'],
    });

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: '可恢复的学习会话' })).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '火' }));
    expect(await screen.findByRole('heading', { name: '一起看清这个词' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一题' }));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'としょかん' }));
    await screen.findByRole('heading', { name: '理解正确' });
    fireEvent.click(screen.getByRole('button', { name: '完成练习' }));

    expect(await screen.findByRole('heading', { name: '3 道示例题已完成' })).toBeInTheDocument();
    expect(screen.getByText(/已有 6 条/)).toBeInTheDocument();
  });

  it('restores feedback after the page is remounted', async () => {
    const { createUseCase, persistence } = createHarness();
    const firstRender = render(
      <ThemeProvider initialTheme="light">
        <StudyDemoPage createUseCase={createUseCase} />
      </ThemeProvider>,
    );

    await screen.findByRole('heading', { name: '可恢复的学习会话' });
    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    await screen.findByRole('heading', { name: '理解正确' });
    firstRender.unmount();

    render(
      <ThemeProvider initialTheme="light">
        <StudyDemoPage createUseCase={createUseCase} />
      </ThemeProvider>,
    );

    expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();
    expect(await persistence.findBySessionId('ui-test-session')).toHaveLength(2);
  });
});
