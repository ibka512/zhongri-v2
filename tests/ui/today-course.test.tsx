import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppRoutes } from '../../src/app/router';
import type { TodayCourseSession } from '../../src/app/todayCourse';
import { createDailyCourse } from '../../src/application/course';
import { StudyUseCase } from '../../src/application/study';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import { TodayCoursePage } from '../../src/pages/TodayCourse';
import { LearnerProfileSchema, QuestionType } from '../../src/schemas/v1';
import { ThemeProvider } from '../../src/ui/theme';

const repository: CanonicalContentRepositoryPort = {
  getManifest: () => jaN5StarterManifest,
  listByLanguage: (language) => (language === 'ja' ? jaN5StarterWords : []),
  findById: (language, wordId) =>
    jaN5StarterWords.find((word) => word.language === language && word.id === wordId) ?? null,
  resolveIdentity: () => ({ status: 'not-found' }),
  verifyIntegrity: async () => {
    throw new Error('Integrity verification belongs to the composition root');
  },
};

function createHarness() {
  const persistence = new InMemoryStudyPersistence();
  const dailyCourse = createDailyCourse(repository, '2026-07-24');
  let id = 0;
  let timestamp = Date.parse('2026-07-24T01:00:00.000Z');
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
        return `today-ui-event-${id}`;
      },
    },
    persistence,
  };
  const input = {
    items: dailyCourse.items,
    sessionId: dailyCourse.plan.id,
    userId: 'today-ui-user',
  };
  const insights = {
    dueReviewCount: 0,
    profile: LearnerProfileSchema.parse({
      schemaVersion: 1,
      projectionVersion: 1,
      userId: input.userId,
      language: 'ja',
      answeredCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 0,
      averageResponseTimeMs: null,
      recentIncorrectItemIds: [],
      recentTrend: 'insufficient',
      projectedThrough: null,
    }),
    recentIncorrectWords: [],
  };
  const createCourse = async (): Promise<TodayCourseSession> => ({
    ...dailyCourse,
    insights,
    useCase: await StudyUseCase.startOrResume(input, dependencies),
  });
  const restartCourse = async (): Promise<TodayCourseSession> => ({
    ...dailyCourse,
    insights,
    useCase: await StudyUseCase.restart(input, dependencies),
  });

  return { createCourse, dailyCourse, persistence, restartCourse };
}

describe('TodayCoursePage', () => {
  it('uses the formal daily course as the hosted root experience', async () => {
    const { createCourse, restartCourse } = createHarness();
    const router = createMemoryRouter(
      createAppRoutes({
        createTodayCourse: createCourse,
        restartTodayCourse: restartCourse,
      }),
      { initialEntries: ['/'] },
    );

    render(
      <ThemeProvider initialTheme="light">
        <RouterProvider router={router} />
      </ThemeProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: '今天，稳稳学 5 个日语词' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始今日课程' })).toBeInTheDocument();
    expect(screen.getByText('暂无薄弱证据')).toBeInTheDocument();
    expect(screen.getByText('还没有历史答题证据，今天先从 N5 基础词开始。')).toBeInTheDocument();
  });

  it('completes choice and text questions and shows a meaningful result', async () => {
    const { createCourse, dailyCourse, persistence, restartCourse } = createHarness();
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '开始今日课程' }));

    for (const [index, item] of dailyCourse.items.entries()) {
      const question = item.question;
      expect(await screen.findByText(`${index + 1} / 5`)).toBeInTheDocument();

      if (question.type === QuestionType.Choice) {
        const correctId = question.answer.correctOptionIds[0];
        const correctOption = question.options.find((option) => option.id === correctId);
        if (!correctOption) {
          throw new Error('Expected a correct choice option');
        }
        fireEvent.click(screen.getByRole('button', { name: correctOption.label }));
      } else {
        fireEvent.change(screen.getByRole('textbox', { name: '你的答案' }), {
          target: { value: question.answer.acceptedAnswers[0] },
        });
        fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
      }

      expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', {
          name: index === dailyCourse.items.length - 1 ? '查看学习结果' : '下一题',
        }),
      );
    }

    expect(
      await screen.findByRole('heading', { name: '今天的 5 个词，完成了' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(await persistence.findBySessionId(dailyCourse.plan.id)).toHaveLength(10);
  });

  it('restores feedback after remounting without losing the answer events', async () => {
    const { createCourse, dailyCourse, persistence, restartCourse } = createHarness();
    const first = render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '开始今日课程' }));
    const firstQuestion = dailyCourse.items[0].question;
    if (firstQuestion.type !== QuestionType.Choice) {
      throw new Error('The first daily question must be a choice');
    }
    const correctId = firstQuestion.answer.correctOptionIds[0];
    const correctOption = firstQuestion.options.find((option) => option.id === correctId);
    if (!correctOption) {
      throw new Error('Expected a correct choice option');
    }
    fireEvent.click(screen.getByRole('button', { name: correctOption.label }));
    await screen.findByRole('heading', { name: '理解正确' });
    first.unmount();

    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '继续今日课程' }));
    expect(await screen.findByRole('heading', { name: '理解正确' })).toBeInTheDocument();
    expect(await persistence.findBySessionId(dailyCourse.plan.id)).toHaveLength(2);
  });
});
