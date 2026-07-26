import { z } from 'zod';

import { ContractVersionSchema } from './shared';

const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const MIGRATION_SAMPLING_CATEGORY_ORDER = [
  'builtin-ja',
  'builtin-en',
  'overrides',
  'user-words',
  'related-favorites',
  'related-folders',
  'related-mastery',
  'related-studyRecords',
  'related-groupProgress',
  'related-wrongBook',
  'related-aiConversations',
  'related-aiQuizHistory',
  'related-recycleBin',
  'related-preferences',
  'related-fsrsCards',
  'related-fsrsLogs',
] as const;

export const MigrationSamplingCategorySchema = z.enum(MIGRATION_SAMPLING_CATEGORY_ORDER);

export const MigrationSamplingCategoryResultSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    category: MigrationSamplingCategorySchema,
    availableCount: z.number().int().nonnegative(),
    sampleCount: z.number().int().nonnegative(),
    sampledSourceRefs: z.array(z.string().trim().min(1).max(500)).max(100),
    mismatchSourceRefs: z.array(z.string().trim().min(1).max(500)).max(100),
    passed: z.boolean(),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.sampleCount !== result.sampledSourceRefs.length) {
      context.addIssue({
        code: 'custom',
        path: ['sampleCount'],
        message: 'Sampling sampleCount must equal sampledSourceRefs length',
      });
    }
    if (result.passed !== (result.mismatchSourceRefs.length === 0)) {
      context.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'Sampling category passed must match mismatchSourceRefs',
      });
    }
  });

export const MigrationSamplingEvidenceSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    evidenceKind: z.literal('v1-migration-fixed-sampling'),
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    seedSourceFingerprint: Sha256Schema,
    categories: z
      .array(MigrationSamplingCategoryResultSchema)
      .length(MIGRATION_SAMPLING_CATEGORY_ORDER.length),
    passed: z.boolean(),
    evidenceDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.seedSourceFingerprint !== evidence.sourceFingerprint) {
      context.addIssue({
        code: 'custom',
        path: ['seedSourceFingerprint'],
        message: 'Sampling evidence must use sourceFingerprint as its deterministic seed',
      });
    }

    const expectedIds = MIGRATION_SAMPLING_CATEGORY_ORDER;
    const actualIds = evidence.categories.map((category) => category.category);
    if (new Set(actualIds).size !== actualIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'Sampling evidence categories must be unique',
      });
    }
    for (const [index, expectedId] of expectedIds.entries()) {
      if (actualIds[index] !== expectedId) {
        context.addIssue({
          code: 'custom',
          path: ['categories', index, 'category'],
          message: 'Sampling evidence categories must use the fixed order',
        });
      }
    }

    const passed = evidence.categories.every((category) => category.passed);
    if (evidence.passed !== passed) {
      context.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'Sampling evidence passed must match all category results',
      });
    }
  });

const MIGRATION_ROLLBACK_DRILL_PHASE_ORDER = ['stage', 'commit', 'rollback'] as const;

export const MigrationRollbackDrillPhaseSchema = z.enum(MIGRATION_ROLLBACK_DRILL_PHASE_ORDER);

export const MigrationRollbackDrillPhaseResultSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    phase: MigrationRollbackDrillPhaseSchema,
    failureInjected: z.literal(true),
    operationRejected: z.boolean(),
    activeDatasetIdBefore: z.string().trim().min(1).max(255).nullable(),
    activeDatasetIdAfter: z.string().trim().min(1).max(255).nullable(),
    migrationStatusBefore: z
      .enum([
        'NOT_STARTED',
        'SNAPSHOTTING',
        'IN_PROGRESS',
        'VALIDATING',
        'COMMITTING',
        'COMPLETED',
        'FAILED',
        'ROLLED_BACK',
      ])
      .nullable(),
    migrationStatusAfter: z
      .enum([
        'NOT_STARTED',
        'SNAPSHOTTING',
        'IN_PROGRESS',
        'VALIDATING',
        'COMMITTING',
        'COMPLETED',
        'FAILED',
        'ROLLED_BACK',
      ])
      .nullable(),
    datasetSnapshotDigestSha256: Sha256Schema,
    passed: z.boolean(),
  })
  .strict();

export const MigrationRollbackDrillEvidenceSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    evidenceKind: z.literal('v1-migration-rollback-drill'),
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    phases: z
      .array(MigrationRollbackDrillPhaseResultSchema)
      .length(MIGRATION_ROLLBACK_DRILL_PHASE_ORDER.length),
    passed: z.boolean(),
    evidenceDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((evidence, context) => {
    const actualPhases = evidence.phases.map((phase) => phase.phase);
    if (new Set(actualPhases).size !== actualPhases.length) {
      context.addIssue({
        code: 'custom',
        path: ['phases'],
        message: 'Rollback drill phases must be unique',
      });
    }
    for (const [index, expectedPhase] of MIGRATION_ROLLBACK_DRILL_PHASE_ORDER.entries()) {
      if (actualPhases[index] !== expectedPhase) {
        context.addIssue({
          code: 'custom',
          path: ['phases', index, 'phase'],
          message: 'Rollback drill phases must use the fixed stage/commit/rollback order',
        });
      }
    }
    const passed = evidence.phases.every((phase) => phase.passed);
    if (evidence.passed !== passed) {
      context.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'Rollback drill passed must match all phase results',
      });
    }
  });

export const MigrationVerificationCheckIdSchema = z.enum([
  'V01',
  'V02',
  'V03',
  'V04',
  'V05',
  'V06',
  'V07',
  'V08',
  'V09',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
  'V18',
  'V19',
  'V20',
  'V21',
  'V22',
  'V23',
  'V24',
  'V25',
]);

export const MigrationVerificationCheckStatusSchema = z.enum(['passed', 'failed', 'unverified']);

export const MigrationVerificationSeveritySchema = z.enum(['blocking', 'warning', 'info']);

export const MigrationVerificationCheckSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    checkId: MigrationVerificationCheckIdSchema,
    status: MigrationVerificationCheckStatusSchema,
    severity: MigrationVerificationSeveritySchema,
    reasonCode: z.string().trim().min(1).max(128),
    message: z.string().trim().min(1).max(1_000),
    expected: z.string().max(2_000).nullable(),
    observed: z.string().max(2_000).nullable(),
  })
  .strict();

export const MigrationVerificationReportSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    reportKind: z.literal('v1-migration-verification'),
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    checks: z.array(MigrationVerificationCheckSchema).length(25),
    passed: z.boolean(),
    blockingCheckIds: z.array(MigrationVerificationCheckIdSchema).max(25),
    reportDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((report, context) => {
    const expectedIds = MigrationVerificationCheckIdSchema.options;
    const actualIds = report.checks.map((check) => check.checkId);
    if (new Set(actualIds).size !== actualIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['checks'],
        message: 'Migration verification checks must contain one record per check ID',
      });
    }
    for (const [index, expectedId] of expectedIds.entries()) {
      if (actualIds[index] !== expectedId) {
        context.addIssue({
          code: 'custom',
          path: ['checks', index, 'checkId'],
          message: 'Migration verification checks must use the fixed V01–V25 order',
        });
      }
    }

    const blockingIds = report.checks
      .filter((check) => check.status !== 'passed' && check.severity === 'blocking')
      .map((check) => check.checkId);
    if (JSON.stringify(report.blockingCheckIds) !== JSON.stringify(blockingIds)) {
      context.addIssue({
        code: 'custom',
        path: ['blockingCheckIds'],
        message: 'Blocking check IDs must match failed or unverified blocking checks',
      });
    }

    const passed = report.checks.every((check) => check.status === 'passed');
    if (report.passed !== passed) {
      context.addIssue({
        code: 'custom',
        path: ['passed'],
        message: 'Verification report passed must match all check statuses',
      });
    }
  });

export const migrationVerificationCheckIds = MigrationVerificationCheckIdSchema.options;
export const migrationSamplingCategoryOrder = MIGRATION_SAMPLING_CATEGORY_ORDER;
export const migrationRollbackDrillPhaseOrder = MIGRATION_ROLLBACK_DRILL_PHASE_ORDER;

export type MigrationVerificationCheckId = z.infer<typeof MigrationVerificationCheckIdSchema>;
export type MigrationVerificationCheckStatus = z.infer<
  typeof MigrationVerificationCheckStatusSchema
>;
export type MigrationVerificationSeverity = z.infer<typeof MigrationVerificationSeveritySchema>;
export type MigrationVerificationCheck = z.infer<typeof MigrationVerificationCheckSchema>;
export type MigrationVerificationReport = z.infer<typeof MigrationVerificationReportSchema>;
export type MigrationSamplingCategory = z.infer<typeof MigrationSamplingCategorySchema>;
export type MigrationSamplingCategoryResult = z.infer<typeof MigrationSamplingCategoryResultSchema>;
export type MigrationSamplingEvidence = z.infer<typeof MigrationSamplingEvidenceSchema>;
export type MigrationRollbackDrillPhase = z.infer<typeof MigrationRollbackDrillPhaseSchema>;
export type MigrationRollbackDrillPhaseResult = z.infer<
  typeof MigrationRollbackDrillPhaseResultSchema
>;
export type MigrationRollbackDrillEvidence = z.infer<typeof MigrationRollbackDrillEvidenceSchema>;
