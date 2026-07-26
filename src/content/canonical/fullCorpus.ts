import {
  CanonicalCorpusManifestSchema,
  CanonicalWordSchema,
  type CanonicalCorpusManifest,
  type CanonicalWord,
} from '../../schemas/v1';

export const jpStudyCanonicalCorpusManifest: CanonicalCorpusManifest =
  CanonicalCorpusManifestSchema.parse({
    schemaVersion: 1,
    id: 'jp-study-corpus-v1',
    contentVersion: 1,
    totalWordCount: 9_828,
    languageCounts: [
      { language: 'ja', wordCount: 5_906 },
      { language: 'en', wordCount: 3_922 },
    ],
    wordIdsSha256: '792f7baafd2be3eaa4f267d3090381fb2552a7390305a516e24602eae9745ac5',
    contentSha256: 'e1b2904c8fc695bf416f3130c527d9a2c4ac4b8f53a28ff35ec021f4e6a098df',
    source: {
      repository: 'ibka512/jp-study',
      commitSha: '36c8129dfc364453198790b64687ff9105a3ecae',
      path: 'wordbanks/ (assets.js, ja-001..007.js, en-001..005.js)',
      blobSha: 'b3faa98bdd25ec3fddf0a87e3ca9f1f0053db387',
      licenseSummary:
        'MIT and CC BY-SA 4.0 derived assets; see docs/content/THIRD_PARTY_CONTENT.md',
    },
  });

export async function loadJpStudyCanonicalWords(): Promise<readonly CanonicalWord[]> {
  const [japanese, english] = await Promise.all([
    import('./assets/ja.json'),
    import('./assets/en.json'),
  ]);

  return Object.freeze(
    CanonicalWordSchema.array().parse([...japanese.default, ...english.default]),
  );
}
