import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import { DexieStudyPersistence, InMemoryStudyPersistence } from '../../src/infrastructure/study';
import {
  IdempotencyConflictError,
  type CommitAnswerInput,
  type StudyPersistencePort,
} from '../../src/ports';
import {
  JudgementResultSchema,
  LearningEventSchema,
  StudySessionCheckpointSchema,
  StudySessionStateSchema,
} from '../../src/schemas/v1';

function createCommitInput(answer = 'neko'): CommitAnswerInput {
  const judgement = JudgementResultSchema.parse({
    schemaVersion: 1,
    questionId: 'question-1',
    status: 'correct',
    userAnswer: answer,
    expectedAnswer: 'neko',
    errorReason: null,
    feedbackText: '回答正确。',
    requiresAiExplanation: false,
  });
  const common = {
    schemaVersion: 1 as const,
    timestamp: '2026-07-24T01:00:01.250Z',
    sessionId: 'session-1',
    userId: 'user-1',
    itemId: 'item-1',
    questionId: 'question-1',
  };
  const events = [
    LearningEventSchema.parse({
      ...common,
      id: 'event-1',
      eventType: 'answerSubmitted',
      payload: {
        answer,
        responseTimeMs: 1_250,
      },
    }),
    LearningEventSchema.parse({
      ...common,
      id: 'event-2',
      eventType: 'answerCorrect',
      payload: {
        answer,
        expectedAnswer: 'neko',
        responseTimeMs: 1_250,
      },
    }),
  ];
  const checkpoint = StudySessionCheckpointSchema.parse({
    schemaVersion: 1,
    sessionId: 'session-1',
    userId: 'user-1',
    currentIndex: 0,
    questionId: 'question-1',
    status: 'feedback',
    selectedAnswer: answer,
    judgement,
    eventIds: ['event-1', 'event-2'],
    updatedAt: '2026-07-24T01:00:01.250Z',
  });
  const sessionState = StudySessionStateSchema.parse({
    schemaVersion: 1,
    sessionId: 'session-1',
    userId: 'user-1',
    itemReferences: [
      { itemId: 'item-1', questionId: 'question-1' },
      { itemId: 'item-2', questionId: 'question-2' },
    ],
    currentIndex: 0,
    status: 'feedback',
    selectedAnswer: answer,
    judgement,
    eventIds: ['event-1', 'event-2'],
    updatedAt: '2026-07-24T01:00:01.250Z',
  });

  return {
    idempotencyKey: 'session-1:question-1',
    requestFingerprint: JSON.stringify(['session-1', 'question-1', answer]),
    events,
    checkpoint,
    sessionState,
  };
}

interface PersistenceHarness {
  persistence: StudyPersistencePort;
  cleanup: () => Promise<void>;
}

const openDatabases: DexieStudyPersistence[] = [];

afterEach(async () => {
  await Promise.all(openDatabases.splice(0).map((database) => database.delete()));
});

const harnesses: Array<{
  name: string;
  create: () => PersistenceHarness;
}> = [
  {
    name: 'memory',
    create: () => ({
      persistence: new InMemoryStudyPersistence(),
      cleanup: async () => undefined,
    }),
  },
  {
    name: 'dexie',
    create: () => {
      const database = new DexieStudyPersistence(`zhongri-v2-test-${crypto.randomUUID()}`);
      openDatabases.push(database);
      return {
        persistence: database,
        cleanup: async () => database.close(),
      };
    },
  },
];

describe.each(harnesses)('$name study persistence contract', ({ create }) => {
  it('atomically commits events, checkpoint and idempotency record', async () => {
    const { cleanup, persistence } = create();
    const input = createCommitInput();

    const first = await persistence.commitAnswer(input);
    const replay = await persistence.commitAnswer(input);

    expect(first.status).toBe('committed');
    expect(replay.status).toBe('replayed');
    expect(replay.events.map((event) => event.id)).toEqual(['event-1', 'event-2']);
    expect(await persistence.findBySessionId('session-1')).toHaveLength(2);
    expect(await persistence.findCheckpoint('session-1')).toEqual(input.checkpoint);
    expect(await persistence.findSessionState('session-1')).toEqual(input.sessionState);

    await cleanup();
  });

  it('replays the original checkpoint after the active session advances', async () => {
    const { cleanup, persistence } = create();
    const firstInput = createCommitInput();
    await persistence.commitAnswer(firstInput);

    const secondInput: CommitAnswerInput = {
      ...createCommitInput(),
      idempotencyKey: 'session-1:question-2',
      requestFingerprint: JSON.stringify(['session-1', 'question-2', 'neko']),
      events: createCommitInput().events.map((event, index) => ({
        ...event,
        id: `event-${index + 3}`,
        questionId: 'question-2',
      })),
      checkpoint: {
        ...createCommitInput().checkpoint,
        currentIndex: 1,
        questionId: 'question-2',
        judgement: {
          ...createCommitInput().checkpoint.judgement,
          questionId: 'question-2',
        },
        eventIds: ['event-3', 'event-4'],
      },
      sessionState: StudySessionStateSchema.parse({
        ...createCommitInput().sessionState,
        currentIndex: 1,
        selectedAnswer: 'neko',
        judgement: {
          ...createCommitInput().sessionState.judgement,
          questionId: 'question-2',
        },
        eventIds: ['event-1', 'event-2', 'event-3', 'event-4'],
      }),
    };
    await persistence.commitAnswer(secondInput);

    const replay = await persistence.commitAnswer(firstInput);

    expect(replay.status).toBe('replayed');
    expect(replay.checkpoint.currentIndex).toBe(0);
    expect(replay.checkpoint.questionId).toBe('question-1');
    expect(replay.sessionState.currentIndex).toBe(0);
    expect(await persistence.findCheckpoint('session-1')).toMatchObject({
      currentIndex: 1,
      questionId: 'question-2',
    });
    expect(await persistence.findSessionState('session-1')).toMatchObject({
      currentIndex: 1,
      status: 'feedback',
    });

    await cleanup();
  });

  it('rejects reuse of an idempotency key for a different answer', async () => {
    const { cleanup, persistence } = create();
    await persistence.commitAnswer(createCommitInput());

    await expect(
      persistence.commitAnswer({
        ...createCommitInput('inu'),
        events: createCommitInput('inu').events.map((event, index) => ({
          ...event,
          id: `conflict-event-${index + 1}`,
        })),
      }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await persistence.findBySessionId('session-1')).toHaveLength(2);

    await cleanup();
  });
});

describe('in-memory transaction rollback', () => {
  it('does not expose partial writes after a failure', async () => {
    const persistence = new InMemoryStudyPersistence();
    persistence.failNextCommit();

    await expect(persistence.commitAnswer(createCommitInput())).rejects.toThrow(
      'Injected transaction failure',
    );
    expect(await persistence.findBySessionId('session-1')).toEqual([]);
    expect(await persistence.findCheckpoint('session-1')).toBeNull();
    expect(await persistence.findSessionState('session-1')).toBeNull();
  });
});
