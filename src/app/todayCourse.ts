import {
  createDailyCourse,
  formatLocalDate,
  type DailyCourse,
  type DailyCoursePriority,
} from '../application/course';
import { projectLearningState } from '../application/profile';
import { StudyUseCase } from '../application/study';
import { FsrsReviewScheduler } from '../infrastructure/review';
import { cryptoIdGenerator, webClock } from '../infrastructure/system';
import type { CanonicalWord, LearnerProfile, LearningProjection, TodayPlan } from '../schemas/v1';
import { createCanonicalContentRepository } from './content';
import { appPersistence } from './persistence';

const localUserId = 'local-v2-user';
const reviewScheduler = new FsrsReviewScheduler();

export interface TodayCourseSession extends DailyCourse {
  insights: {
    dueReviewCount: number;
    profile: LearnerProfile;
    recentIncorrectWords: readonly CanonicalWord[];
  };
  useCase: StudyUseCase;
}

function localDayRange(localDate: string): { end: Date; start: Date } {
  const [year, month, day] = localDate.split('-').map(Number);
  return {
    start: new Date(year, month - 1, day),
    end: new Date(year, month - 1, day + 1),
  };
}

export function createTodayCoursePriorities(
  projection: LearningProjection,
  dayEnd: Date,
): DailyCoursePriority[] {
  const due = projection.reviewStates
    .filter((state) => new Date(state.due) < dayEnd)
    .sort(
      (left, right) => left.due.localeCompare(right.due) || left.itemId.localeCompare(right.itemId),
    )
    .map((state) => ({
      reason: 'due-review' as const,
      wordId: state.itemId,
    }));
  const dueIds = new Set(due.map((priority) => priority.wordId));
  const recentIncorrect = projection.profile.recentIncorrectItemIds
    .filter((wordId) => !dueIds.has(wordId))
    .map((wordId) => ({
      reason: 'recent-incorrect' as const,
      wordId,
    }));

  return [...due, ...recentIncorrect];
}

async function createCourseForDate(
  localDate: string,
  mode: 'start-or-resume' | 'restart',
): Promise<TodayCourseSession> {
  const repository = await createCanonicalContentRepository();
  const words = repository.listByLanguage('ja');
  const knownItemIds = new Set(words.map((word) => word.id));
  const dayRange = localDayRange(localDate);
  const allEvents = await appPersistence.findByUserId(localUserId);
  const historicalProjection = projectLearningState({
    events: allEvents.filter((event) => new Date(event.timestamp) < dayRange.start),
    knownItemIds,
    language: 'ja',
    scheduler: reviewScheduler,
    userId: localUserId,
  });
  const priorities = createTodayCoursePriorities(historicalProjection, dayRange.end);
  const course = createDailyCourse(repository, localDate, priorities);
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
  const projectionEvents =
    mode === 'restart' ? await appPersistence.findByUserId(localUserId) : allEvents;
  const currentProjection = projectLearningState({
    events: projectionEvents,
    knownItemIds,
    language: 'ja',
    scheduler: reviewScheduler,
    userId: localUserId,
  });
  await appPersistence.replaceLearningProjection(currentProjection);
  const dueReviewCount = historicalProjection.reviewStates.filter(
    (state) => new Date(state.due) < dayRange.end,
  ).length;
  const recentIncorrectWords = historicalProjection.profile.recentIncorrectItemIds
    .map((wordId) => repository.findById('ja', wordId))
    .filter((word): word is CanonicalWord => word !== null);

  return {
    ...course,
    insights: {
      dueReviewCount,
      profile: historicalProjection.profile,
      recentIncorrectWords,
    },
    useCase,
  };
}

export function createTodayCourse(): Promise<TodayCourseSession> {
  return createCourseForDate(formatLocalDate(webClock.now()), 'start-or-resume');
}

export function restartTodayCourse(plan: TodayPlan): Promise<TodayCourseSession> {
  return createCourseForDate(plan.localDate, 'restart');
}
