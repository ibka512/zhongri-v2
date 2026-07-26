import { z } from 'zod';

import { ContractVersionSchema, LanguageSchema, NonBlankStringSchema } from './shared';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const WordIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{2,127}$/);

export const MigrationIdentitySourceKindSchema = z.enum(['word', 'override-reference', 'relation']);

export const MigrationIdentityMapOutcomeSchema = z.enum(['mapped', 'quarantined']);

export const MigrationIdentityMapResolutionSchema = z.enum([
  'canonical-exact',
  'canonical-headword-candidate',
  'canonical-headword-ambiguous',
  'canonical-language-conflict',
  'user-id-preserved',
  'user-id-generated',
  'not-found',
  'invalid',
]);

export const MigrationIdentityMapConfidenceSchema = z
  .enum(['exact', 'candidate', 'heuristic', 'preserved', 'generated'])
  .nullable();

export const MigrationIdentityMapReasonSchema = z.enum([
  'CANONICAL_ID_MATCH',
  'CANONICAL_HEADWORD_HEURISTIC',
  'USER_ID_PRESERVED',
  'USER_ID_GENERATED',
  'USER_ID_DUPLICATE_GENERATED',
  'CANONICAL_ID_CONFLICT_GENERATED',
  'EMPTY_IDENTITY',
  'CANONICAL_CONTEXT_REQUIRED',
  'CANONICAL_HEADWORD_AMBIGUOUS',
  'CANONICAL_LANGUAGE_CONFLICT',
  'CANONICAL_NOT_FOUND',
  'OVERRIDE_ORPHAN',
  'RELATION_UNRESOLVED',
  'BUILT_IN_UNRESOLVED',
  'INVALID_USER_ID',
  'MISSING_RAW_RECORD_DIGEST',
  'DUPLICATE_TARGET_ID',
]);

export const MigrationIdentityMapQuarantineCodeSchema = z.enum([
  'EMPTY_IDENTITY',
  'CANONICAL_CONTEXT_REQUIRED',
  'CANONICAL_HEADWORD_AMBIGUOUS',
  'CANONICAL_LANGUAGE_CONFLICT',
  'CANONICAL_NOT_FOUND',
  'OVERRIDE_ORPHAN',
  'RELATION_UNRESOLVED',
  'BUILT_IN_UNRESOLVED',
  'INVALID_USER_ID',
  'MISSING_RAW_RECORD_DIGEST',
  'DUPLICATE_TARGET_ID',
]);

export const MigrationIdentityMapRecordInputSchema = z
  .object({
    sourceRef: NonBlankStringSchema.max(500),
    sourceKind: MigrationIdentitySourceKindSchema,
    language: LanguageSchema.nullable().optional(),
    wordId: z.string().trim().max(128).nullable().optional(),
    headword: z.string().max(200).nullable().optional(),
    folder: z.string().max(200).nullable().optional(),
    reading: z.string().max(200).nullable().optional(),
    phonetic: z.string().max(200).nullable().optional(),
    sourceId: z.string().max(128).nullable().optional(),
    importedAt: z.string().max(100).nullable().optional(),
    isBuiltIn: z.boolean().nullable().optional(),
    rawRecordDigestSha256: Sha256Schema.nullable().optional(),
  })
  .strict();

export const MigrationIdentityMapInputSchema = z
  .object({
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    records: z.array(MigrationIdentityMapRecordInputSchema).max(100_000),
  })
  .strict();

export const MigrationIdentityMapEntrySchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    sourceRef: NonBlankStringSchema.max(500),
    sourceKind: MigrationIdentitySourceKindSchema,
    language: LanguageSchema,
    languageDefaulted: z.boolean(),
    rawWordId: z.string().trim().max(128).nullable(),
    rawHeadword: z.string().max(200).nullable(),
    normalizedHeadword: NonBlankStringSchema.max(200).nullable(),
    normalizedFolder: NonBlankStringSchema.max(200).nullable(),
    rawRecordDigestSha256: Sha256Schema.nullable(),
    outcome: MigrationIdentityMapOutcomeSchema,
    resolution: MigrationIdentityMapResolutionSchema,
    mappingConfidence: MigrationIdentityMapConfidenceSchema,
    reasonCode: MigrationIdentityMapReasonSchema,
    quarantineCode: MigrationIdentityMapQuarantineCodeSchema.nullable(),
    targetWordId: WordIdSchema.nullable(),
    targetKind: z.enum(['canonical', 'user']).nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.outcome === 'mapped') {
      if (!entry.targetWordId || !entry.targetKind || entry.quarantineCode) {
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'Mapped identity entries require a target and cannot be quarantined',
        });
      }
    }

    if (entry.outcome === 'quarantined') {
      if (entry.targetWordId || entry.targetKind || !entry.quarantineCode) {
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'Quarantined identity entries cannot create an active target',
        });
      }
    }

    if (entry.targetKind === 'canonical' && entry.resolution === 'user-id-preserved') {
      context.addIssue({
        code: 'custom',
        path: ['targetKind'],
        message: 'A preserved user id cannot target a canonical word',
      });
    }
  });

const MigrationIdentityMapCountsSchema = z
  .object({
    source: z.number().int().nonnegative(),
    mapped: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    canonical: z.number().int().nonnegative(),
    user: z.number().int().nonnegative(),
  })
  .strict();

export const MigrationIdentityMapSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    canonicalManifestId: NonBlankStringSchema.max(128),
    canonicalManifestDigestSha256: Sha256Schema,
    canonicalWordIdsDigestSha256: Sha256Schema,
    entries: z.array(MigrationIdentityMapEntrySchema).max(100_000),
    counts: MigrationIdentityMapCountsSchema,
    mapDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((map, context) => {
    if (map.counts.source !== map.entries.length) {
      context.addIssue({
        code: 'custom',
        path: ['counts', 'source'],
        message: 'Identity map source count must equal the number of entries',
      });
    }

    const mapped = map.entries.filter((entry) => entry.outcome === 'mapped').length;
    const quarantined = map.entries.filter((entry) => entry.outcome === 'quarantined').length;
    const canonical = map.entries.filter((entry) => entry.targetKind === 'canonical').length;
    const user = map.entries.filter((entry) => entry.targetKind === 'user').length;
    if (
      map.counts.mapped !== mapped ||
      map.counts.quarantined !== quarantined ||
      map.counts.canonical !== canonical ||
      map.counts.user !== user ||
      mapped + quarantined !== map.counts.source
    ) {
      context.addIssue({
        code: 'custom',
        path: ['counts'],
        message: 'Identity map counts must match entry outcomes and targets',
      });
    }

    const sourceRefs = new Set<string>();
    for (const [index, entry] of map.entries.entries()) {
      if (sourceRefs.has(entry.sourceRef)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'sourceRef'],
          message: 'Identity map source references must be unique',
        });
      }
      sourceRefs.add(entry.sourceRef);

      if (index > 0 && map.entries[index - 1].sourceRef >= entry.sourceRef) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'sourceRef'],
          message: 'Identity map entries must be sorted by sourceRef',
        });
      }
    }
  });

export type MigrationIdentitySourceKind = z.infer<typeof MigrationIdentitySourceKindSchema>;
export type MigrationIdentityMapOutcome = z.infer<typeof MigrationIdentityMapOutcomeSchema>;
export type MigrationIdentityMapResolution = z.infer<typeof MigrationIdentityMapResolutionSchema>;
export type MigrationIdentityMapConfidence = z.infer<typeof MigrationIdentityMapConfidenceSchema>;
export type MigrationIdentityMapReason = z.infer<typeof MigrationIdentityMapReasonSchema>;
export type MigrationIdentityMapQuarantineCode = z.infer<
  typeof MigrationIdentityMapQuarantineCodeSchema
>;
export type MigrationIdentityMapRecordInput = z.infer<typeof MigrationIdentityMapRecordInputSchema>;
export type MigrationIdentityMapInput = z.infer<typeof MigrationIdentityMapInputSchema>;
export type MigrationIdentityMapEntry = z.infer<typeof MigrationIdentityMapEntrySchema>;
export type MigrationIdentityMap = z.infer<typeof MigrationIdentityMapSchema>;
