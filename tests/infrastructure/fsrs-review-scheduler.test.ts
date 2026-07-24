import { describe, expect, it } from 'vitest';

import { FsrsReviewScheduler } from '../../src/infrastructure/review';

describe('FsrsReviewScheduler', () => {
  it('is deterministic and schedules incorrect recall before correct recall', () => {
    const scheduler = new FsrsReviewScheduler();
    const base = {
      eventId: 'event-1',
      itemId: 'word-1',
      previous: null,
      reviewedAt: '2026-07-24T01:00:00.000Z',
      userId: 'learner-1',
    };
    const good = scheduler.schedule({ ...base, rating: 'good' });
    const repeatedGood = scheduler.schedule({ ...base, rating: 'good' });
    const again = scheduler.schedule({ ...base, rating: 'again' });

    expect(repeatedGood).toEqual(good);
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
    expect(good.algorithm).toBe('fsrs-6');
    expect(good.schedulerVersion).toBe('ts-fsrs@5.4.1');
  });

  it('continues from the prior card state during replay', () => {
    const scheduler = new FsrsReviewScheduler();
    const first = scheduler.schedule({
      eventId: 'event-1',
      itemId: 'word-1',
      previous: null,
      rating: 'good',
      reviewedAt: '2026-07-24T01:00:00.000Z',
      userId: 'learner-1',
    });
    const second = scheduler.schedule({
      eventId: 'event-2',
      itemId: 'word-1',
      previous: first,
      rating: 'good',
      reviewedAt: '2026-08-01T01:00:00.000Z',
      userId: 'learner-1',
    });

    expect(second.reps).toBe(first.reps + 1);
    expect(second.lastEventId).toBe('event-2');
    expect(second.lastReview).toBe('2026-08-01T01:00:00.000Z');
  });
});
