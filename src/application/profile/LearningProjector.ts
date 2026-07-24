import type { ReviewSchedulerPort } from '../../ports/review';
import {
  EventType,
  LearnerProfileSchema,
  LearningProjectionSchema,
  type Language,
  type LearningEvent,
  type LearningProjection,
} from '../../schemas/v1';

export interface ProjectLearningStateInput {
  events: readonly LearningEvent[];
  knownItemIds: ReadonlySet<string>;
  language: Language;
  scheduler: ReviewSchedulerPort;
  userId: string;
}

function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function projectTrend(events: readonly LearningEvent[]) {
  if (events.length < 6) {
    return 'insufficient' as const;
  }

  const recent = events.slice(-6);
  const firstAccuracy =
    recent.slice(0, 3).filter((event) => event.eventType === EventType.AnswerCorrect).length / 3;
  const latestAccuracy =
    recent.slice(3).filter((event) => event.eventType === EventType.AnswerCorrect).length / 3;
  const difference = latestAccuracy - firstAccuracy;

  if (difference >= 0.34) {
    return 'improving' as const;
  }
  if (difference <= -0.34) {
    return 'declining' as const;
  }
  return 'stable' as const;
}

function recentIncorrectItemIds(events: readonly LearningEvent[]): string[] {
  const latestOutcome = new Map<string, LearningEvent>();

  for (const event of events) {
    if (event.itemId) {
      latestOutcome.set(event.itemId, event);
    }
  }

  return [...latestOutcome.values()]
    .reverse()
    .filter((event) => event.eventType === EventType.AnswerIncorrect)
    .map((event) => event.itemId)
    .filter((itemId): itemId is string => itemId !== null)
    .slice(0, 5);
}

export function projectLearningState(input: ProjectLearningStateInput): LearningProjection {
  const judgedEvents = input.events
    .filter(
      (event) =>
        event.userId === input.userId &&
        event.itemId !== null &&
        input.knownItemIds.has(event.itemId) &&
        (event.eventType === EventType.AnswerCorrect ||
          event.eventType === EventType.AnswerIncorrect),
    )
    .sort(
      (left, right) =>
        left.timestamp.localeCompare(right.timestamp) || left.id.localeCompare(right.id),
    );
  const reviewStates = new Map<string, ReturnType<ReviewSchedulerPort['schedule']>>();

  for (const event of judgedEvents) {
    const itemId = event.itemId;
    if (!itemId) {
      continue;
    }

    reviewStates.set(
      itemId,
      input.scheduler.schedule({
        eventId: event.id,
        itemId,
        previous: reviewStates.get(itemId) ?? null,
        rating: event.eventType === EventType.AnswerCorrect ? 'good' : 'again',
        reviewedAt: event.timestamp,
        userId: input.userId,
      }),
    );
  }

  const correctCount = judgedEvents.filter(
    (event) => event.eventType === EventType.AnswerCorrect,
  ).length;
  const incorrectCount = judgedEvents.length - correctCount;
  const responseTimes = judgedEvents
    .map((event) => event.payload.responseTimeMs)
    .filter((value): value is number => value !== undefined);
  const averageResponseTimeMs =
    responseTimes.length === 0
      ? null
      : Math.round(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length);
  const profile = LearnerProfileSchema.parse({
    schemaVersion: 1,
    projectionVersion: 1,
    userId: input.userId,
    language: input.language,
    answeredCount: judgedEvents.length,
    correctCount,
    incorrectCount,
    accuracy: judgedEvents.length === 0 ? 0 : round(correctCount / judgedEvents.length),
    averageResponseTimeMs,
    recentIncorrectItemIds: recentIncorrectItemIds(judgedEvents),
    recentTrend: projectTrend(judgedEvents),
    projectedThrough: judgedEvents.at(-1)?.timestamp ?? null,
  });

  return LearningProjectionSchema.parse({
    profile,
    reviewStates: [...reviewStates.values()].sort((left, right) =>
      left.itemId.localeCompare(right.itemId),
    ),
  });
}
