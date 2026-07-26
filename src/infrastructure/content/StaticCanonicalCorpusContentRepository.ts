import type {
  CanonicalContentRepositoryPort,
  CanonicalCorpusIntegrityReport,
  ResolveCanonicalIdentityInput,
  TextDigestPort,
} from '../../ports';
import {
  CanonicalCorpusManifestSchema,
  CanonicalWordSchema,
  canonicalCorpusV1AcceptanceTarget,
  type CanonicalCorpusManifest,
  type CanonicalWord,
  type Language,
} from '../../schemas/v1';

import { verifyCanonicalCorpusIntegrity } from './CanonicalCorpusIntegrity';
import { CanonicalContentConflictError } from './StaticCanonicalContentRepository';

function normalizeHeadword(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

function identityKey(language: Language, wordId: string): string {
  return `${language}:${wordId}`;
}

function freezeWord(word: CanonicalWord): CanonicalWord {
  Object.freeze(word.tags);
  Object.freeze(word.source);
  return Object.freeze(word);
}

export class StaticCanonicalCorpusContentRepository implements CanonicalContentRepositoryPort {
  readonly #manifest: CanonicalCorpusManifest;
  readonly #words: readonly CanonicalWord[];
  readonly #digest: TextDigestPort;
  readonly #wordsByIdentity = new Map<string, CanonicalWord>();
  readonly #wordsByHeadword = new Map<string, CanonicalWord[]>();

  constructor(input: {
    manifest: CanonicalCorpusManifest;
    words: readonly CanonicalWord[];
    digest: TextDigestPort;
  }) {
    const manifest = CanonicalCorpusManifestSchema.parse(input.manifest);
    Object.freeze(manifest.languageCounts);
    Object.freeze(manifest.source);
    this.#manifest = Object.freeze(manifest);
    this.#words = Object.freeze(CanonicalWordSchema.array().parse(input.words).map(freezeWord));
    this.#digest = input.digest;

    for (const word of this.#words) {
      const key = identityKey(word.language, word.id);
      if (this.#wordsByIdentity.has(key)) {
        throw new CanonicalContentConflictError(`Duplicate canonical identity "${key}"`);
      }
      this.#wordsByIdentity.set(key, word);

      const headwordKey = identityKey(word.language, normalizeHeadword(word.headword));
      const matches = this.#wordsByHeadword.get(headwordKey) ?? [];
      matches.push(word);
      this.#wordsByHeadword.set(headwordKey, matches);
    }
  }

  getManifest(): CanonicalCorpusManifest {
    return this.#manifest;
  }

  listByLanguage(language: Language): readonly CanonicalWord[] {
    return this.#words.filter((word) => word.language === language);
  }

  findById(language: Language, wordId: string): CanonicalWord | null {
    return this.#wordsByIdentity.get(identityKey(language, wordId.trim())) ?? null;
  }

  resolveIdentity(input: ResolveCanonicalIdentityInput) {
    const wordId = input.wordId?.trim();
    if (wordId) {
      const exact = this.findById(input.language, wordId);
      if (exact) {
        return { status: 'exact' as const, word: exact };
      }

      const conflictingWord = this.#words.find((word) => word.id === wordId);
      if (conflictingWord) {
        return { status: 'language-conflict' as const, conflictingWord };
      }
    }

    const headword = input.headword?.trim();
    if (!headword) {
      return { status: 'not-found' as const };
    }

    const candidates =
      this.#wordsByHeadword.get(identityKey(input.language, normalizeHeadword(headword))) ?? [];
    if (candidates.length === 1) {
      return { status: 'candidate' as const, word: candidates[0] };
    }
    if (candidates.length > 1) {
      return { status: 'ambiguous' as const, candidates };
    }

    return { status: 'not-found' as const };
  }

  verifyIntegrity(): Promise<CanonicalCorpusIntegrityReport> {
    return verifyCanonicalCorpusIntegrity({
      manifest: this.#manifest,
      words: this.#words,
      digest: this.#digest,
      acceptanceTarget: canonicalCorpusV1AcceptanceTarget,
    });
  }
}
