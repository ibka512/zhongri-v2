import { z } from 'zod';

import { ContractVersionSchema, LanguageSchema, NonBlankStringSchema } from './shared';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GitShaSchema = z.string().regex(/^[a-f0-9]{40}$/);

export const CanonicalWordSourceSchema = z
  .object({
    manifestId: z.string().trim().min(1).max(128),
    sourceName: z.string().trim().min(1).max(300),
    sourceVersion: z.string().trim().min(1).max(300).nullable(),
  })
  .strict();

export const CanonicalWordSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{2,127}$/),
    language: LanguageSchema,
    headword: NonBlankStringSchema.max(200),
    reading: NonBlankStringSchema.max(200).nullable(),
    phonetic: NonBlankStringSchema.max(200).nullable(),
    partOfSpeech: NonBlankStringSchema.max(200),
    meaning: NonBlankStringSchema.max(2_000),
    level: NonBlankStringSchema.max(64),
    difficulty: z.number().int().min(0).max(10),
    tags: z.array(NonBlankStringSchema.max(100)).max(50),
    isBuiltIn: z.literal(true),
    dataVersion: z.number().int().positive(),
    source: CanonicalWordSourceSchema,
  })
  .strict()
  .superRefine((word, context) => {
    if (word.language === 'ja' && !word.reading) {
      context.addIssue({
        code: 'custom',
        path: ['reading'],
        message: 'Japanese canonical words require a reading',
      });
    }

    if (new Set(word.tags).size !== word.tags.length) {
      context.addIssue({
        code: 'custom',
        path: ['tags'],
        message: 'Canonical word tags must be unique',
      });
    }
  });

export const CanonicalManifestSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    id: z.string().trim().min(1).max(128),
    contentVersion: z.number().int().positive(),
    language: LanguageSchema,
    level: NonBlankStringSchema.max(64),
    wordCount: z.number().int().positive(),
    wordIdsSha256: Sha256Schema,
    contentSha256: Sha256Schema,
    source: z
      .object({
        repository: z
          .string()
          .trim()
          .regex(/^[^/\s]+\/[^/\s]+$/),
        commitSha: GitShaSchema,
        path: NonBlankStringSchema.max(500),
        blobSha: GitShaSchema,
        licenseSummary: NonBlankStringSchema.max(500),
      })
      .strict(),
  })
  .strict();

export type CanonicalWord = z.infer<typeof CanonicalWordSchema>;
export type CanonicalManifest = z.infer<typeof CanonicalManifestSchema>;
