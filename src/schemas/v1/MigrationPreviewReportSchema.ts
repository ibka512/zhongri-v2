import { z } from 'zod';

import { ContractVersionSchema } from './shared';

export const MigrationPreviewStatusSchema = z.enum(['ready', 'review', 'blocked']);
export const MigrationIssueSeveritySchema = z.enum(['info', 'warning', 'blocking']);
export const MigrationPreviewDomainSchema = z.enum([
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
]);

export const MigrationPreviewSourceSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().nonnegative(),
    fileDigestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    format: z.enum(['modern', 'legacy-v4']),
    backupVersion: z.number().int().nonnegative(),
    dataSchemaVersion: z.number().int().nonnegative(),
    appName: z.string().trim().min(1).max(100),
    kind: z.string().trim().min(1).max(100),
    exportDate: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const MigrationDomainSummarySchema = z
  .object({
    domain: MigrationPreviewDomainSchema,
    sourceCount: z.number().int().nonnegative(),
    migratableCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    conflictCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    notes: z.array(z.string().trim().min(1).max(500)).max(20),
  })
  .strict()
  .superRefine((summary, context) => {
    const classifiedCount =
      summary.migratableCount + summary.skippedCount + summary.conflictCount + summary.errorCount;

    if (classifiedCount !== summary.sourceCount) {
      context.addIssue({
        code: 'custom',
        path: ['sourceCount'],
        message: 'Every source record must have exactly one preview classification',
      });
    }
  });

export const MigrationPreviewIssueSchema = z
  .object({
    code: z.string().trim().min(1).max(128),
    domain: MigrationPreviewDomainSchema,
    severity: MigrationIssueSeveritySchema,
    message: z.string().trim().min(1).max(1_000),
    recovery: z.string().trim().min(1).max(1_000),
    count: z.number().int().positive(),
    sampleRefs: z.array(z.string().trim().min(1).max(128)).max(3),
  })
  .strict();

export const MigrationPreviewAssumptionSchema = z
  .object({
    id: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12']),
    decision: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const MigrationPreviewTotalsSchema = z
  .object({
    source: z.number().int().nonnegative(),
    migratable: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    conflicts: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((totals, context) => {
    if (totals.migratable + totals.skipped + totals.conflicts + totals.errors !== totals.source) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Preview totals must classify every source record',
      });
    }
  });

export const MigrationPreviewReportSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    previewedAt: z.string().datetime({ offset: true }),
    status: MigrationPreviewStatusSchema,
    source: MigrationPreviewSourceSchema,
    totals: MigrationPreviewTotalsSchema,
    domains: z.array(MigrationDomainSummarySchema).min(1).max(30),
    issues: z.array(MigrationPreviewIssueSchema).max(500),
    assumptions: z.array(MigrationPreviewAssumptionSchema).length(12),
    writesPerformed: z.literal(false),
  })
  .strict();

export type MigrationPreviewStatus = z.infer<typeof MigrationPreviewStatusSchema>;
export type MigrationPreviewDomain = z.infer<typeof MigrationPreviewDomainSchema>;
export type MigrationPreviewIssue = z.infer<typeof MigrationPreviewIssueSchema>;
export type MigrationDomainSummary = z.infer<typeof MigrationDomainSummarySchema>;
export type MigrationPreviewReport = z.infer<typeof MigrationPreviewReportSchema>;
