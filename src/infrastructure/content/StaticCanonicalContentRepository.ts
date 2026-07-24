import type {
  CanonicalContentRepositoryPort,
  CanonicalIdentityResolution,
  CanonicalIntegrityReport,
  ResolveCanonicalIdentityInput,
  TextDigestPort,
} from '../../ports';
import {
  CanonicalManifestSchema,
  CanonicalWordSchema,
  type CanonicalManifest,
  type CanonicalWord,
  type Language,
} from '../../schemas/v1';

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

export function createCanonicalWordIdsPayload(words: readonly CanonicalWord[]): string {
  return words
    .map((word) => identityKey(word.language, word.id))
    .sort()
    .join('\n');
}

export function createCanonicalContentPayload(words: readonly CanonicalWord[]): string {
  return JSON.stringify(
    [...words].sort((left, right) =>
      identityKey(left.language, left.id).localeCompare(identityKey(right.language, right.id)),
    ),
  );
}

export class CanonicalContentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalContentConflictError';
  }
}

export class StaticCanonicalContentRepository implements CanonicalContentRepositoryPort {
  readonly #manifest: CanonicalManifest;
  readonly #words: readonly CanonicalWord[];
  readonly #digest: TextDigestPort;
  readonly #wordsByIdentity = new Map<string, CanonicalWord>();
  readonly #wordsByHeadword = new Map<string, CanonicalWord[]>();

  constructor(input: {
    manifest: CanonicalManifest;
    words: readonly CanonicalWord[];
    digest: TextDigestPort;
  }) {
    const manifest = CanonicalManifestSchema.parse(input.manifest);
    Object.freeze(manifest.source);
    this.#manifest = Object.freeze(manifest);
    this.#words = Object.freeze(CanonicalWordSchema.array().parse(input.words).map(freezeWord));
    this.#digest = input.digest;

    for (const word of this.#words) {
      if (word.language !== this.#manifest.language) {
        throw new CanonicalContentConflictError(
          `Word "${word.id}" does not match manifest language "${this.#manifest.language}"`,
        );
      }
      if (word.source.manifestId !== this.#manifest.id) {
        throw new CanonicalContentConflictError(
          `Word "${word.id}" does not reference manifest "${this.#manifest.id}"`,
        );
      }

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

  getManifest(): CanonicalManifest {
    return this.#manifest;
  }

  listByLanguage(language: Language): readonly CanonicalWord[] {
    return this.#words.filter((word) => word.language === language);
  }

  findById(language: Language, wordId: string): CanonicalWord | null {
    return this.#wordsByIdentity.get(identityKey(language, wordId.trim())) ?? null;
  }

  resolveIdentity(input: ResolveCanonicalIdentityInput): CanonicalIdentityResolution {
    const wordId = input.wordId?.trim();
    if (wordId) {
      const exact = this.findById(input.language, wordId);
      if (exact) {
        return { status: 'exact', word: exact };
      }

      const conflictingWord = this.#words.find((word) => word.id === wordId);
      if (conflictingWord) {
        return { status: 'language-conflict', conflictingWord };
      }
    }

    const headword = input.headword?.trim();
    if (!headword) {
      return { status: 'not-found' };
    }

    const candidates =
      this.#wordsByHeadword.get(identityKey(input.language, normalizeHeadword(headword))) ?? [];
    if (candidates.length === 1) {
      return { status: 'candidate', word: candidates[0] };
    }
    if (candidates.length > 1) {
      return { status: 'ambiguous', candidates };
    }

    return { status: 'not-found' };
  }

  async verifyIntegrity(): Promise<CanonicalIntegrityReport> {
    const errors: string[] = [];
    const [actualWordIdsSha256, actualContentSha256] = await Promise.all([
      this.#digest.sha256(createCanonicalWordIdsPayload(this.#words)),
      this.#digest.sha256(createCanonicalContentPayload(this.#words)),
    ]);

    if (this.#words.length !== this.#manifest.wordCount) {
      errors.push(
        `Manifest expects ${this.#manifest.wordCount} words but loaded ${this.#words.length}`,
      );
    }
    if (actualWordIdsSha256 !== this.#manifest.wordIdsSha256) {
      errors.push('Canonical word identity digest does not match the manifest');
    }
    if (actualContentSha256 !== this.#manifest.contentSha256) {
      errors.push('Canonical word content digest does not match the manifest');
    }

    return {
      valid: errors.length === 0,
      expectedWordCount: this.#manifest.wordCount,
      actualWordCount: this.#words.length,
      expectedWordIdsSha256: this.#manifest.wordIdsSha256,
      actualWordIdsSha256,
      expectedContentSha256: this.#manifest.contentSha256,
      actualContentSha256,
      errors,
    };
  }
}
