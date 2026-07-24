import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
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
  const input = {
    items: studyDemoItems,
    sessionId: 'ui-test-session',
    userId: 'ui-test-user',
  };
  const dependencies = {
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
  };
  const createUseCase = () => StudyUseCase.startOrResume(input, dependencies);
  const restartUseCase = () => StudyUseCase.restart(input, dependencies);

  return { createUseCase, persistence, restartUseCase };
}

describe('StudyDemoPage', () => {
  it('completes three mock questions with correct and incorrect feedback', async () => {
    const { createUseCase, persistence, restartUseCase } = createHarness();
    const router = createMemoryRouter(
      createAppRoutes({
        createStudyDemoUseCase: createUseCase,
        previewV1Backup: async () => {
          throw new Error('Migration preview is not used in this test');
        },
        restartStudyDemoUseCase: restartUseCase,
        serializeMigrationPreview: () => '',
        stageV1Backup: async () => {
          throw new Error('Migration staging is not used in this test');
        },
      }),
      {
        initialEntries: ['/study-demo'],
      },
    );

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

    fireEvent.click(screen.getByRole('button', { name: '重新开始本次练习' }));
    fireEvent.click(screen.getByRole('button', { name: '确认重新开始' }));

    expect(await screen.findByRole('heading', { name: '可恢复的学习会话' })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await persistence.findBySessionId('ui-test-session')).toEqual([]);
    });
  });

  it('restores feedback after the page is remounted', async () => {
    const { createUseCase, persistence, restartUseCase } = createHarness();
    const firstRender = render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <StudyDemoPage createUseCase={createUseCase} restartUseCase={restartUseCase} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '可恢复的学习会话' });
    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    await screen.findByRole('heading', { name: '理解正确' });
    firstRender.unmount();

    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <StudyDemoPage createUseCase={createUseCase} restartUseCase={restartUseCase} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();
    expect(await persistence.findBySessionId('ui-test-session')).toHaveLength(2);
  });

  it('requires confirmation and lets the learner keep the current progress', async () => {
    const { createUseCase, persistence, restartUseCase } = createHarness();
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <StudyDemoPage createUseCase={createUseCase} restartUseCase={restartUseCase} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '可恢复的学习会话' });
    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    await screen.findByRole('heading', { name: '理解正确' });

    fireEvent.click(screen.getByRole('button', { name: '重新开始本次练习' }));
    expect(screen.getByRole('group', { name: '确认重新开始' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保留当前进度' }));

    expect(screen.queryByRole('group', { name: '确认重新开始' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '理解正确' })).toBeInTheDocument();
    expect(await persistence.findBySessionId('ui-test-session')).toHaveLength(2);
  });

  it('keeps durable and visible progress when restarting fails', async () => {
    const { createUseCase, persistence, restartUseCase } = createHarness();
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <StudyDemoPage createUseCase={createUseCase} restartUseCase={restartUseCase} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '可恢复的学习会话' });
    fireEvent.click(screen.getByRole('button', { name: 'ねこ' }));
    await screen.findByRole('heading', { name: '理解正确' });
    persistence.failNextOperation();

    fireEvent.click(screen.getByRole('button', { name: '重新开始本次练习' }));
    fireEvent.click(screen.getByRole('button', { name: '确认重新开始' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '无法重新开始，原有进度仍然保留。请重试。',
    );
    expect(screen.getByRole('heading', { name: '理解正确' })).toBeInTheDocument();
    expect(await persistence.findBySessionId('ui-test-session')).toHaveLength(2);
  });
});
