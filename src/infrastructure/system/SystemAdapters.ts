import type { ClockPort, IdGeneratorPort } from '../../ports';

export const webClock: ClockPort = {
  now: () => new Date(),
};

export const cryptoIdGenerator: IdGeneratorPort = {
  nextId: () => crypto.randomUUID(),
};
