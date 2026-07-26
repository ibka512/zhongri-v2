import type { TextDigestPort } from '../../ports';
import {
  CanonicalCorpusManifestSchema,
  CanonicalWordSchema,
  type CanonicalCorpusAcceptanceTarget,
  type CanonicalCorpusManifest,
  type CanonicalWord,
  type Language,
} from '../../schemas/v1';

import {
  createCanonicalContentPayload,
  createCanonicalWordIdsPayload,
} from './StaticCanonicalContentRepository';

export interface CanonicalCorpusIntegrityReport {
  valid: boolean;
  expectedTotalWordCount: number;
  actualTotalWordCount: number;
  expectedLanguageCounts: Readonly<Record<Language, number>>;
  actualLanguageCounts: Readonly<Record<Language, number>>;
  expectedWordIdsSha256: string;
  actualWordIdsSha256: string;
  expectedContentSha256: string;
  actualContentSha256: string;
  errors: readonly string[];
}

function countLanguages(words: readonly CanonicalWord[]): Record<Language, number> {
  return words.reduce<Record<Language, number>>(
    (counts, word) => {
      counts[word.language] += 1;
      return counts;
    },
    { ja: 0, en: 0 },
  );
}

function manifestLanguageCounts(manifest: CanonicalCorpusManifest): Record<Language, number> {
  return manifest.languageCounts.reduce<Record<Language, number>>(
    (counts, entry) => {
      counts[entry.language] = entry.wordCount;
      return counts;
    },
    { ja: 0, en: 0 },
  );
}

export async function verifyCanonicalCorpusIntegrity(input: {
  manifest: CanonicalCorpusManifest;
  words: readonly CanonicalWord[];
  digest: TextDigestPort;
  acceptanceTarget?: CanonicalCorpusAcceptanceTarget;
}): Promise<CanonicalCorpusIntegrityReport> {
  const manifest = CanonicalCorpusManifestSchema.parse(input.manifest);
  const words = CanonicalWordSchema.array().parse(input.words);
  const errors: string[] = [];
  const expectedLanguageCounts = manifestLanguageCounts(manifest);
  const actualLanguageCounts = countLanguages(words);
  const identities = new Set<string>();

  if (input.acceptanceTarget) {
    if (manifest.totalWordCount !== input.acceptanceTarget.totalWordCount) {
      errors.push(
        `Canonical corpus manifest target requires ${input.acceptanceTarget.totalWordCount} total words`,
      );
    }

    for (const language of ['ja', 'en'] as const) {
      if (expectedLanguageCounts[language] !== input.acceptanceTarget.languageCounts[language]) {
        errors.push(
          `Canonical corpus manifest target requires ${input.acceptanceTarget.languageCounts[language]} ${language} words`,
        );
      }
    }
  }

  for (const word of words) {
    const identity = `${word.language}:${word.id}`;
    if (identities.has(identity)) {
      errors.push(`Duplicate canonical corpus identity "${identity}"`);
    }
    identities.add(identity);
  }

  if (words.length !== manifest.totalWordCount) {
    errors.push(`Manifest expects ${manifest.totalWordCount} words but loaded ${words.length}`);
  }

  for (const language of ['ja', 'en'] as const) {
    if (actualLanguageCounts[language] !== expectedLanguageCounts[language]) {
      errors.push(
        `Manifest expects ${expectedLanguageCounts[language]} ${language} words but loaded ${actualLanguageCounts[language]}`,
      );
    }
  }

  const [actualWordIdsSha256, actualContentSha256] = await Promise.all([
    input.digest.sha256(createCanonicalWordIdsPayload(words)),
    input.digest.sha256(createCanonicalContentPayload(words)),
  ]);

  if (actualWordIdsSha256 !== manifest.wordIdsSha256) {
    errors.push('Canonical corpus identity digest does not match the manifest');
  }
  if (actualContentSha256 !== manifest.contentSha256) {
    errors.push('Canonical corpus content digest does not match the manifest');
  }

  return {
    valid: errors.length === 0,
    expectedTotalWordCount: manifest.totalWordCount,
    actualTotalWordCount: words.length,
    expectedLanguageCounts,
    actualLanguageCounts,
    expectedWordIdsSha256: manifest.wordIdsSha256,
    actualWordIdsSha256,
    expectedContentSha256: manifest.contentSha256,
    actualContentSha256,
    errors,
  };
}
