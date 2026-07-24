import { describe, expect, it } from 'vitest';

import { jaN5StarterManifest, jaN5StarterWords } from '../../src/content';
import { CanonicalManifestSchema, CanonicalWordSchema } from '../../src/schemas/v1';

describe('canonical content schemas v1', () => {
  it('accepts the pinned Japanese N5 starter manifest and its 20 words', () => {
    expect(CanonicalManifestSchema.parse(jaN5StarterManifest)).toEqual(jaN5StarterManifest);
    expect(CanonicalWordSchema.array().parse(jaN5StarterWords)).toHaveLength(20);
  });

  it('keeps the original jp-study stable ids and source evidence', () => {
    expect(jaN5StarterWords.map((word) => word.id)).toEqual(
      expect.arrayContaining([
        'builtin-ja-core-00005',
        'builtin-ja-core-00012',
        'builtin-ja-import-1f90abf644753f',
      ]),
    );
    expect(
      jaN5StarterWords.every((word) => word.source.manifestId === jaN5StarterManifest.id),
    ).toBe(true);
    expect(jaN5StarterManifest.source).toMatchObject({
      repository: 'ibka512/jp-study',
      commitSha: '36c8129dfc364453198790b64687ff9105a3ecae',
      path: 'wordbanks/ja-001.js',
      blobSha: '72ac88e5d7f893d46acab46b96f07ae22ea80356',
    });
  });

  it('rejects Japanese words without a reading', () => {
    expect(
      CanonicalWordSchema.safeParse({
        ...jaN5StarterWords[0],
        reading: null,
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate tags instead of silently normalizing canonical content', () => {
    expect(
      CanonicalWordSchema.safeParse({
        ...jaN5StarterWords[0],
        tags: ['N5', 'N5'],
      }).success,
    ).toBe(false);
  });
});
