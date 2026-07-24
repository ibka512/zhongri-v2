import { z } from 'zod';

import { MigrationPreviewReportSchema } from './MigrationPreviewReportSchema';
import { ContractVersionSchema } from './shared';

export const MigrationRunStatusSchema = z.enum([
  'NOT_STARTED',
  'SNAPSHOTTING',
  'IN_PROGRESS',
  'VALIDATING',
  'COMMITTING',
  'COMPLETED',
  'FAILED',
  'ROLLED_BACK',
]);

export const MigrationPhaseSchema = z.enum([
  'snapshot',
  'staging',
  'validation',
  'commit',
  'rollback',
]);

export const MigrationValidationSummarySchema = z
  .object({
    passed: z.boolean(),
    errors: z.array(z.string().trim().min(1).max(1_000)).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.passed && value.errors.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['errors'],
        message: 'A passing migration validation cannot contain errors',
      });
    }
  });

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const DatasetIdSchema = z.string().regex(/^dataset:v1-v2:[a-f0-9]{24}:spec-1$/);

export const MigrationRunSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    migrationId: MigrationIdSchema,
    specVersion: z.literal(1),
    datasetId: DatasetIdSchema,
    sourceFingerprint: Sha256Schema,
    sourceFileName: z.string().trim().min(1).max(255),
    sourceFormat: z.enum(['modern', 'legacy-v4']),
    backupVersion: z.number().int().nonnegative(),
    status: MigrationRunStatusSchema,
    lastCompletedPhase: MigrationPhaseSchema.nullable(),
    startedAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    rolledBackAt: z.string().datetime({ offset: true }).nullable(),
    priorActiveDatasetId: z.string().trim().min(1).max(255).nullable(),
    commitMarker: z.string().trim().min(1).max(255).nullable(),
    snapshotDigestSha256: Sha256Schema,
    reportDigestSha256: Sha256Schema,
    containsRedactedSecrets: z.boolean(),
    validation: MigrationValidationSummarySchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (run.datasetId !== `dataset:${run.migrationId}`) {
      context.addIssue({
        code: 'custom',
        path: ['datasetId'],
        message: 'Migration datasetId must be derived from migrationId',
      });
    }

    if (run.status === 'COMPLETED') {
      if (!run.completedAt || !run.commitMarker || run.lastCompletedPhase !== 'commit') {
        context.addIssue({
          code: 'custom',
          path: ['status'],
          message: 'A completed migration requires its commit metadata',
        });
      }

      if (!run.validation.passed) {
        context.addIssue({
          code: 'custom',
          path: ['validation'],
          message: 'A failed validation cannot be committed',
        });
      }
    }

    if (run.status === 'ROLLED_BACK' && (!run.rolledBackAt || !run.commitMarker)) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'A rolled back migration requires rollback metadata',
      });
    }
  });

export const MigrationStagingDatasetSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    datasetId: DatasetIdSchema,
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    sanitizedSourceText: z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
    snapshotDigestSha256: Sha256Schema,
    reportDigestSha256: Sha256Schema,
    previewReport: MigrationPreviewReportSchema,
    validation: MigrationValidationSummarySchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((dataset, context) => {
    if (dataset.datasetId !== `dataset:${dataset.migrationId}`) {
      context.addIssue({
        code: 'custom',
        path: ['datasetId'],
        message: 'Migration datasetId must be derived from migrationId',
      });
    }

    if (dataset.sourceFingerprint !== dataset.previewReport.source.fileDigestSha256) {
      context.addIssue({
        code: 'custom',
        path: ['sourceFingerprint'],
        message: 'Staging source fingerprint must match the preview report',
      });
    }
  });

export const ActiveMigrationDatasetPointerSchema = z
  .object({
    id: z.literal('active-migration-dataset'),
    activeDatasetId: z.string().trim().min(1).max(255).nullable(),
    commitMarker: z.string().trim().min(1).max(255).nullable(),
    updatedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type MigrationRunStatus = z.infer<typeof MigrationRunStatusSchema>;
export type MigrationPhase = z.infer<typeof MigrationPhaseSchema>;
export type MigrationValidationSummary = z.infer<typeof MigrationValidationSummarySchema>;
export type MigrationRun = z.infer<typeof MigrationRunSchema>;
export type MigrationStagingDataset = z.infer<typeof MigrationStagingDatasetSchema>;
export type ActiveMigrationDatasetPointer = z.infer<typeof ActiveMigrationDatasetPointerSchema>;
