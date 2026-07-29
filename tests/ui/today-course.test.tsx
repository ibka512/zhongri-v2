import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { GenerateQuestionsOutcome } from '../../src/application/ai';
import { createAppRoutes } from '../../src/app/router';
import type { TodayCourseSession } from '../../src/app/todayCourse';
import { createDailyCourse } from '../../src/application/course';
import { StudyUseCase } from '../../src/application/study';
import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { InMemoryStudyPersistence } from '../../src/infrastructure/study';
import type { CanonicalContentRepositoryPort } from '../../src/ports';
import { TodayCoursePage } from '../../src/pages/TodayCourse';
import {
  CanonicalWordSchema,
  LearnerProfileSchema,
  LearnerSettingsSchema,
  QuestionType,
} from '../../src/schemas/v1';
import { validGenerateQuestionsResponse } from '../fixtures/ai-task-protocol';
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

const englishWords = jaN5StarterWords.map((word, index) =>
  CanonicalWordSchema.parse({
    ...word,
    id: `en-${String(index + 1).padStart(3, '0')}`,
    language: 'en',
    headword: `word-${index + 1}`,
    reading: null,
    meaning: `meaning ${index + 1}`,
  }),
);

const bilingualRepository: CanonicalContentRepositoryPort = {
  ...repository,
  listByLanguage: (language) => (language === 'en' ? englishWords : jaN5StarterWords),
  findById: (language, wordId) =>
    (language === 'en' ? englishWords : jaN5StarterWords).find((word) => word.id === wordId) ??
    null,
};

function createHarness(
  language: 'ja' | 'en' = 'ja',
  aiOutcome: GenerateQuestionsOutcome = {
    status: 'fallback',
    reason: 'gateway-not-configured',
    response: null,
  },
) {
  const persistence = new InMemoryStudyPersistence();
  const dailyCourse = createDailyCourse(bilingualRepository, '2026-07-24', [], { language });
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
      language,
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
    requestAiQuestions: async () => aiOutcome,
    useCase: await StudyUseCase.startOrResume(input, dependencies),
  });
  const restartCourse = async (): Promise<TodayCourseSession> => ({
    ...dailyCourse,
    insights,
    requestAiQuestions: async () => aiOutcome,
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
        loadUserSettings: async () =>
          LearnerSettingsSchema.parse({
            schemaVersion: 1,
            settingsVersion: 1,
            userId: 'today-ui-user',
            language: 'ja',
            dailyMinutes: 5,
            focus: 'balanced',
            audioEnabled: true,
            setupCompleted: true,
            updatedAt: '2026-07-24T01:00:00.000Z',
          }),
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
      await screen.findByRole('heading', { name: '今天的 5 个日语词，完成了' }),
    ).toBeInTheDocument();
    expect(screen.getByText('5', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(await persistence.findBySessionId(dailyCourse.plan.id)).toHaveLength(10);
  });

  it('requests AI practice only on demand and keeps it outside the learning session', async () => {
    const { createCourse, dailyCourse, persistence, restartCourse } = createHarness('ja', {
      status: 'success',
      response: validGenerateQuestionsResponse,
    });

    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '生成 AI 练习预览' })).toBeInTheDocument();
    expect(screen.queryByText(/AI 已生成/)).not.toBeInTheDocument();
    expect(await persistence.findBySessionId(dailyCourse.plan.id)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '生成 AI 练习预览' }));

    expect(
      await screen.findByText('AI 已生成 2 道结构化练习预览，不会替换今日课程。'),
    ).toBeInTheDocument();
    expect(screen.getByText('時計')).toBeInTheDocument();
    expect(screen.getByText('电话')).toBeInTheDocument();
    expect(screen.getByText('这组内容不会替换今日题目，也不会写入答题记录。')).toBeInTheDocument();
    expect(await persistence.findBySessionId(dailyCourse.plan.id)).toHaveLength(0);
    expect(screen.getByRole('button', { name: '开始今日课程' })).toBeInTheDocument();
  });

  it('shows the local fallback when the on-demand Gateway request fails', async () => {
    const { createCourse, restartCourse } = createHarness();

    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '生成 AI 练习预览' }));

    expect(
      await screen.findByText('AI 暂时不可用，已保留本地规则课程。你仍然可以直接开始今日学习。'),
    ).toBeInTheDocument();
    expect(screen.getByText(/当前环境未配置 Gateway/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始今日课程' })).toBeInTheDocument();
  });

  it('completes the English course through the same plan, answer, and event loop', async () => {
    const { createCourse, dailyCourse, persistence, restartCourse } = createHarness('en');
    render(
      <MemoryRouter>
        <ThemeProvider initialTheme="light">
          <TodayCoursePage createCourse={createCourse} restartCourse={restartCourse} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '今天，稳稳学 5 个英语词' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始今日课程' }));

    for (const [index, item] of dailyCourse.items.entries()) {
      const question = item.question;
      expect(await screen.findByText(`${index + 1} / 5`)).toBeInTheDocument();

      if (question.type === QuestionType.Choice) {
        const correctId = question.answer.correctOptionIds[0];
        const correctOption = question.options.find((option) => option.id === correctId);
        if (!correctOption) {
          throw new Error('Expected a correct English choice option');
        }
        fireEvent.click(screen.getByRole('button', { name: correctOption.label }));
      } else {
        expect(screen.getByText('根据中文释义输入英语单词或音标')).toBeInTheDocument();
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
      await screen.findByRole('heading', { name: '今天的 5 个英语词，完成了' }),
    ).toBeInTheDocument();
    const events = await persistence.findBySessionId(dailyCourse.plan.id);
    expect(events).toHaveLength(10);
    expect(new Set(events.map((event) => event.itemId))).toEqual(
      new Set(dailyCourse.words.map((word) => word.id)),
    );
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
