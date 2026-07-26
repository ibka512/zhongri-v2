import { z } from 'zod';

import { MigrationPreviewDomainSchema } from './MigrationPreviewReportSchema';
import { ContractVersionSchema, IdentifierSchema, NonBlankStringSchema } from './shared';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);

export const MigrationDispositionOutcomeSchema = z.enum(['migrated', 'deduped', 'quarantined']);

export const MigrationDispositionSeveritySchema = z.enum(['info', 'warning', 'blocking']);

export const MigrationDispositionArchiveKindSchema = z.enum(['rawArchive', 'quarantine']);

export const MigrationDispositionInputRecordSchema = z
  .object({
    sourceRef: NonBlankStringSchema.max(500),
    domain: MigrationPreviewDomainSchema,
    sourceRecordDigestSha256: Sha256Schema,
    outcome: MigrationDispositionOutcomeSchema,
    severity: MigrationDispositionSeveritySchema,
    reasonCode: NonBlankStringSchema.max(128),
    quarantineCode: NonBlankStringSchema.max(128).nullable().optional(),
    targetRefs: z.array(IdentifierSchema).max(100).optional(),
    canonicalSourceRef: NonBlankStringSchema.max(500).nullable().optional(),
    rawArchive: z.boolean().optional(),
  })
  .strict();

export const MigrationDispositionInputSchema = z
  .object({
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    identityMapDigestSha256: Sha256Schema,
    records: z.array(MigrationDispositionInputRecordSchema).max(100_000),
  })
  .strict();

export const MigrationDispositionEntrySchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    sourceRef: NonBlankStringSchema.max(500),
    domain: MigrationPreviewDomainSchema,
    sourceRecordDigestSha256: Sha256Schema,
    outcome: MigrationDispositionOutcomeSchema,
    severity: MigrationDispositionSeveritySchema,
    reasonCode: NonBlankStringSchema.max(128),
    quarantineCode: NonBlankStringSchema.max(128).nullable(),
    targetRefs: z.array(IdentifierSchema).max(100),
    canonicalSourceRef: NonBlankStringSchema.max(500).nullable(),
    archiveKind: MigrationDispositionArchiveKindSchema.nullable(),
    archiveRef: IdentifierSchema.max(255).nullable(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.outcome === 'migrated') {
      if (entry.targetRefs.length === 0 || entry.canonicalSourceRef || entry.quarantineCode) {
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'A migrated record requires a target and cannot be a dedupe or quarantine',
        });
      }
    }

    if (entry.outcome === 'deduped') {
      if (
        entry.targetRefs.length === 0 ||
        !entry.canonicalSourceRef ||
        entry.quarantineCode ||
        entry.archiveKind === 'quarantine'
      ) {
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'A deduped record requires a canonical source and active target',
        });
      }
    }

    if (entry.outcome === 'quarantined') {
      if (
        entry.targetRefs.length > 0 ||
        entry.canonicalSourceRef ||
        !entry.quarantineCode ||
        entry.archiveKind !== 'quarantine' ||
        !entry.archiveRef
      ) {
        context.addIssue({
          code: 'custom',
          path: ['outcome'],
          message: 'A quarantined record cannot create an active target',
        });
      }
    }

    if (entry.archiveKind && !entry.archiveRef) {
      context.addIssue({
        code: 'custom',
        path: ['archiveRef'],
        message: 'Archived records require a deterministic archive reference',
      });
    }

    if (entry.archiveKind === 'quarantine' && entry.severity === 'info') {
      context.addIssue({
        code: 'custom',
        path: ['severity'],
        message: 'A quarantined record must be warning or blocking',
      });
    }
  });

const MigrationDispositionCountsSchema = z
  .object({
    source: z.number().int().nonnegative(),
    migrated: z.number().int().nonnegative(),
    deduped: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
    rawArchived: z.number().int().nonnegative(),
  })
  .strict();

export const MigrationDispositionReportSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    identityMapDigestSha256: Sha256Schema,
    entries: z.array(MigrationDispositionEntrySchema).max(100_000),
    counts: MigrationDispositionCountsSchema,
    reportDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((report, context) => {
    const source = report.entries.length;
    const migrated = report.entries.filter((entry) => entry.outcome === 'migrated').length;
    const deduped = report.entries.filter((entry) => entry.outcome === 'deduped').length;
    const quarantined = report.entries.filter((entry) => entry.outcome === 'quarantined').length;
    const rawArchived = report.entries.filter((entry) => entry.archiveKind === 'rawArchive').length;

    if (
      report.counts.source !== source ||
      report.counts.migrated !== migrated ||
      report.counts.deduped !== deduped ||
      report.counts.quarantined !== quarantined ||
      report.counts.rawArchived !== rawArchived ||
      migrated + deduped + quarantined !== source
    ) {
      context.addIssue({
        code: 'custom',
        path: ['counts'],
        message: 'Disposition counts must conserve every source record',
      });
    }

    const sourceRefs = new Set<string>();
    for (const [index, entry] of report.entries.entries()) {
      if (sourceRefs.has(entry.sourceRef)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'sourceRef'],
          message: 'Disposition source references must be unique',
        });
      }
      sourceRefs.add(entry.sourceRef);

      if (index > 0 && report.entries[index - 1].sourceRef >= entry.sourceRef) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'sourceRef'],
          message: 'Disposition entries must be sorted by sourceRef',
        });
      }
    }
  });

export type MigrationDispositionOutcome = z.infer<typeof MigrationDispositionOutcomeSchema>;
export type MigrationDispositionSeverity = z.infer<typeof MigrationDispositionSeveritySchema>;
export type MigrationDispositionArchiveKind = z.infer<typeof MigrationDispositionArchiveKindSchema>;
export type MigrationDispositionInputRecord = z.infer<typeof MigrationDispositionInputRecordSchema>;
export type MigrationDispositionInput = z.infer<typeof MigrationDispositionInputSchema>;
export type MigrationDispositionEntry = z.infer<typeof MigrationDispositionEntrySchema>;
export type MigrationDispositionReport = z.infer<typeof MigrationDispositionReportSchema>;
