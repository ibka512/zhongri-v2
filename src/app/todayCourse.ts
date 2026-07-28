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
import {
  LearningProjectionSchema,
  type CanonicalWord,
  type LearnerProfile,
  type LearningProjection,
  type ReviewState,
  type TodayPlan,
} from '../schemas/v1';
import { createCanonicalContentRepository } from './content';
import { appPersistence } from './persistence';
import { localUserId } from './user';

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

/**
 * Replace the projected states for the active language while keeping states
 * belonging to other canonical language corpora in the shared persistence
 * table. The persistence port intentionally remains an atomic whole-user
 * replacement, so the composition root supplies the complete merged view.
 */
export function mergeCrossLanguageReviewStates(
  projection: LearningProjection,
  existingReviewStates: readonly ReviewState[],
  currentLanguageItemIds: ReadonlySet<string>,
): LearningProjection {
  const preservedReviewStates = existingReviewStates.filter(
    (state) => !currentLanguageItemIds.has(state.itemId),
  );

  return LearningProjectionSchema.parse({
    ...projection,
    reviewStates: [...preservedReviewStates, ...projection.reviewStates].sort((left, right) =>
      left.itemId.localeCompare(right.itemId),
    ),
  });
}

async function createCourseForDate(
  localDate: string,
  mode: 'start-or-resume' | 'restart',
): Promise<TodayCourseSession> {
  const repository = await createCanonicalContentRepository();
  const settings = await appPersistence.findUserSettings(localUserId);
  const language = settings?.language ?? 'ja';
  const estimatedMinutes = settings?.dailyMinutes ?? 5;
  const words = repository.listByLanguage(language);
  const knownItemIds = new Set(words.map((word) => word.id));
  const dayRange = localDayRange(localDate);
  const allEvents = await appPersistence.findByUserId(localUserId);
  const historicalProjection = projectLearningState({
    events: allEvents.filter((event) => new Date(event.timestamp) < dayRange.start),
    knownItemIds,
    language,
    scheduler: reviewScheduler,
    userId: localUserId,
  });
  const priorities = createTodayCoursePriorities(historicalProjection, dayRange.end);
  const course = createDailyCourse(repository, localDate, priorities, {
    estimatedMinutes,
    language,
  });
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
    language,
    scheduler: reviewScheduler,
    userId: localUserId,
  });
  const existingReviewStates = await appPersistence.listReviewStates(localUserId);
  const mergedProjection = mergeCrossLanguageReviewStates(
    currentProjection,
    existingReviewStates,
    knownItemIds,
  );
  await appPersistence.replaceLearningProjection(mergedProjection);
  const dueReviewCount = historicalProjection.reviewStates.filter(
    (state) => new Date(state.due) < dayRange.end,
  ).length;
  const recentIncorrectWords = historicalProjection.profile.recentIncorrectItemIds
    .map((wordId) => repository.findById(language, wordId))
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
