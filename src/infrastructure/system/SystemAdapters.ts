import type { ClockPort, IdGeneratorPort, TextDigestPort } from '../../ports';

export const webClock: ClockPort = {
  now: () => new Date(),
};

export const cryptoIdGenerator: IdGeneratorPort = {
  nextId: () => crypto.randomUUID(),
};

export const webTextDigest: TextDigestPort = {
  sha256: async (text) => {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  },
};
