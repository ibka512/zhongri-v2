import { createDailyCourse, formatLocalDate, type DailyCourse } from '../application/course';
import { StudyUseCase } from '../application/study';
import { cryptoIdGenerator, webClock } from '../infrastructure/system';
import type { TodayPlan } from '../schemas/v1';
import { createCanonicalContentRepository } from './content';
import { appPersistence } from './persistence';

const localUserId = 'local-v2-user';

export interface TodayCourseSession extends DailyCourse {
  useCase: StudyUseCase;
}

async function createCourseForDate(
  localDate: string,
  mode: 'start-or-resume' | 'restart',
): Promise<TodayCourseSession> {
  const repository = await createCanonicalContentRepository();
  const course = createDailyCourse(repository, localDate);
  const input = {
    items: course.items,
    sessionId: course.plan.id,
    userId: localUserId,
  };
  const dependencies = {
    clock: webClock,
    idGenerator: cryptoIdGenerator,
    persistence: appPersistence,
  };
  const useCase =
    mode === 'restart'
      ? await StudyUseCase.restart(input, dependencies)
      : await StudyUseCase.startOrResume(input, dependencies);

  return { ...course, useCase };
}

export function createTodayCourse(): Promise<TodayCourseSession> {
  return createCourseForDate(formatLocalDate(webClock.now()), 'start-or-resume');
}

export function restartTodayCourse(plan: TodayPlan): Promise<TodayCourseSession> {
  return createCourseForDate(plan.localDate, 'restart');
}
