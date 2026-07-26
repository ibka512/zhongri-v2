import type {
  CanonicalCorpusManifest,
  CanonicalManifest,
  CanonicalWord,
  Language,
} from '../../schemas/v1';

export interface ResolveCanonicalIdentityInput {
  language: Language;
  wordId?: string | null;
  headword?: string | null;
}

export type CanonicalIdentityResolution =
  | {
      status: 'exact' | 'candidate';
      word: CanonicalWord;
    }
  | {
      status: 'ambiguous';
      candidates: readonly CanonicalWord[];
    }
  | {
      status: 'language-conflict';
      conflictingWord: CanonicalWord;
    }
  | {
      status: 'not-found';
    };

export interface CanonicalIntegrityReport {
  valid: boolean;
  expectedWordCount: number;
  actualWordCount: number;
  expectedWordIdsSha256: string;
  actualWordIdsSha256: string;
  expectedContentSha256: string;
  actualContentSha256: string;
  errors: readonly string[];
}

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

export type CanonicalContentManifest = CanonicalManifest | CanonicalCorpusManifest;
export type CanonicalContentIntegrityReport =
  CanonicalIntegrityReport | CanonicalCorpusIntegrityReport;

export interface CanonicalContentRepositoryPort {
  getManifest: () => CanonicalContentManifest;
  listByLanguage: (language: Language) => readonly CanonicalWord[];
  findById: (language: Language, wordId: string) => CanonicalWord | null;
  resolveIdentity: (input: ResolveCanonicalIdentityInput) => CanonicalIdentityResolution;
  verifyIntegrity: () => Promise<CanonicalContentIntegrityReport>;
}
