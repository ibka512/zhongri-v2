import { z } from 'zod';

import { MigrationIsolatedArchiveSchema } from './MigrationDomainSliceSchema';

const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const DatasetIdSchema = z.string().regex(/^dataset:v1-v2:[a-f0-9]{24}:spec-1$/);

export const MigrationArchiveRetentionPolicySchema = z.enum([
  'stable-version-cycle',
  'until-user-confirmed-cleanup',
]);

export const MigrationArchiveRecordSchema = MigrationIsolatedArchiveSchema.extend({
  migrationId: MigrationIdSchema,
  datasetId: DatasetIdSchema,
  createdAt: z.string().datetime({ offset: true }),
  retentionPolicy: MigrationArchiveRetentionPolicySchema,
  retentionUntil: z.string().datetime({ offset: true }).nullable(),
  cleanupConfirmedAt: z.string().datetime({ offset: true }).nullable(),
})
  .strict()
  .superRefine((archive, context) => {
    if (archive.datasetId !== `dataset:${archive.migrationId}`) {
      context.addIssue({
        code: 'custom',
        path: ['datasetId'],
        message: 'Migration archive datasetId must be derived from migrationId',
      });
    }

    if (archive.cleanupConfirmedAt && !archive.retentionUntil) {
      context.addIssue({
        code: 'custom',
        path: ['cleanupConfirmedAt'],
        message: 'Cleanup confirmation requires a resolved retention boundary',
      });
    }
  });

export type MigrationArchiveRetentionPolicy = z.infer<typeof MigrationArchiveRetentionPolicySchema>;
export type MigrationArchiveRecord = z.infer<typeof MigrationArchiveRecordSchema>;
