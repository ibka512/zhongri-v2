import { z } from 'zod';

import {
  MigrationPreviewDomainSchema,
  type MigrationPreviewDomain,
} from './MigrationPreviewReportSchema';
import { ContractVersionSchema, NonBlankStringSchema } from './shared';

export const MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH = 30 * 1024 * 1024;
export const MAX_MIGRATION_LEGACY_SOURCE_RECORDS = 100_000;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);

export const MigrationLegacySourceFormatSchema = z.enum(['modern', 'legacy-v4']);

export const MigrationLegacySourceValueTypeSchema = z.enum([
  'null',
  'string',
  'boolean',
  'number',
  'array',
  'object',
]);

export const MigrationLegacySourceReaderInputSchema = z
  .object({
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    sourceFileName: NonBlankStringSchema.max(255),
    sanitizedSourceText: z.string().min(1).max(MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH),
  })
  .strict();

export const MigrationLegacySourceRecordSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    sourceRef: NonBlankStringSchema.max(500),
    domain: MigrationPreviewDomainSchema,
    serializedValue: z.string().min(1).max(MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH),
    sourceValueType: MigrationLegacySourceValueTypeSchema,
    sourceRecordDigestSha256: Sha256Schema,
  })
  .strict();

export const MigrationLegacySourceDomainCountSchema = z
  .object({
    domain: MigrationPreviewDomainSchema,
    count: z.number().int().nonnegative(),
  })
  .strict();

const MIGRATION_LEGACY_SOURCE_DOMAIN_ORDER: readonly MigrationPreviewDomain[] = [
  'words',
  'overrides',
  'folders',
  'favorites',
  'studyRecords',
  'mastery',
  'groupProgress',
  'fsrsCards',
  'fsrsLogs',
  'wrongBook',
  'aiConversations',
  'aiQuizHistory',
  'recycleBin',
  'preferences',
  'unknown',
];

export const MigrationLegacySourceCountsSchema = z
  .object({
    source: z.number().int().nonnegative(),
    byDomain: z
      .array(MigrationLegacySourceDomainCountSchema)
      .length(MIGRATION_LEGACY_SOURCE_DOMAIN_ORDER.length),
  })
  .strict()
  .superRefine((counts, context) => {
    for (const [index, expectedDomain] of MIGRATION_LEGACY_SOURCE_DOMAIN_ORDER.entries()) {
      const item = counts.byDomain[index];
      if (item.domain !== expectedDomain) {
        context.addIssue({
          code: 'custom',
          path: ['byDomain', index, 'domain'],
          message: 'Domain counts must use the fixed migration domain order',
        });
      }
    }

    if (counts.byDomain.reduce((total, item) => total + item.count, 0) !== counts.source) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Source count must equal the sum of domain counts',
      });
    }
  });

export const MigrationLegacySourceSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    readerKind: z.literal('v1-legacy-source'),
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    sourceFileName: NonBlankStringSchema.max(255),
    sourceFormat: MigrationLegacySourceFormatSchema,
    backupVersion: z.number().int().nonnegative(),
    dataSchemaVersion: z.number().int().nonnegative(),
    wordStorageVersion: z.number().int().nonnegative().nullable(),
    appName: NonBlankStringSchema.max(100),
    kind: NonBlankStringSchema.max(100),
    exportDate: z.string().datetime({ offset: true }).nullable(),
    sourceTextDigestSha256: Sha256Schema,
    canonicalSourceDigestSha256: Sha256Schema,
    records: z.array(MigrationLegacySourceRecordSchema).max(MAX_MIGRATION_LEGACY_SOURCE_RECORDS),
    unknownSourceRefs: z
      .array(NonBlankStringSchema.max(500))
      .max(MAX_MIGRATION_LEGACY_SOURCE_RECORDS),
    counts: MigrationLegacySourceCountsSchema,
    readerDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((source, context) => {
    const sourceRefs = new Set<string>();
    const recordCounts = new Map<MigrationPreviewDomain, number>();
    const unknownRefs = new Set<string>();

    for (const [index, record] of source.records.entries()) {
      if (sourceRefs.has(record.sourceRef)) {
        context.addIssue({
          code: 'custom',
          path: ['records', index, 'sourceRef'],
          message: 'Legacy source record references must be unique',
        });
      }
      sourceRefs.add(record.sourceRef);
      recordCounts.set(record.domain, (recordCounts.get(record.domain) ?? 0) + 1);

      if (index > 0 && source.records[index - 1].sourceRef >= record.sourceRef) {
        context.addIssue({
          code: 'custom',
          path: ['records', index, 'sourceRef'],
          message: 'Legacy source records must be sorted by sourceRef',
        });
      }

      if (record.domain === 'unknown') {
        unknownRefs.add(record.sourceRef);
      }
    }

    for (const [index, ref] of source.unknownSourceRefs.entries()) {
      if (index > 0 && source.unknownSourceRefs[index - 1] >= ref) {
        context.addIssue({
          code: 'custom',
          path: ['unknownSourceRefs', index],
          message: 'Unknown source references must be sorted and unique',
        });
      }
      if (!unknownRefs.has(ref)) {
        context.addIssue({
          code: 'custom',
          path: ['unknownSourceRefs', index],
          message: 'Unknown source references must point to unknown records',
        });
      }
    }

    if (unknownRefs.size !== source.unknownSourceRefs.length) {
      context.addIssue({
        code: 'custom',
        path: ['unknownSourceRefs'],
        message: 'Every unknown record must have exactly one unknown source reference',
      });
    }

    if (source.counts.source !== source.records.length) {
      context.addIssue({
        code: 'custom',
        path: ['counts', 'source'],
        message: 'Source count must equal the number of records',
      });
    }

    for (const [index, domain] of MIGRATION_LEGACY_SOURCE_DOMAIN_ORDER.entries()) {
      const expectedCount = recordCounts.get(domain) ?? 0;
      if (source.counts.byDomain[index].count !== expectedCount) {
        context.addIssue({
          code: 'custom',
          path: ['counts', 'byDomain', index, 'count'],
          message: 'Domain count must equal the number of records in that domain',
        });
      }
    }
  });

export const migrationLegacySourceDomainOrder = MIGRATION_LEGACY_SOURCE_DOMAIN_ORDER;

export type MigrationLegacySourceReaderInput = z.infer<
  typeof MigrationLegacySourceReaderInputSchema
>;
export type MigrationLegacySourceFormat = z.infer<typeof MigrationLegacySourceFormatSchema>;
export type MigrationLegacySourceValueType = z.infer<typeof MigrationLegacySourceValueTypeSchema>;
export type MigrationLegacySourceRecord = z.infer<typeof MigrationLegacySourceRecordSchema>;
export type MigrationLegacySourceDomainCount = z.infer<
  typeof MigrationLegacySourceDomainCountSchema
>;
export type MigrationLegacySourceCounts = z.infer<typeof MigrationLegacySourceCountsSchema>;
export type MigrationLegacySource = z.infer<typeof MigrationLegacySourceSchema>;
