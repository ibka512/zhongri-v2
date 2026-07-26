import { z } from 'zod';

import { ContractVersionSchema } from './shared';

const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

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

export type MigrationVerificationCheckId = z.infer<typeof MigrationVerificationCheckIdSchema>;
export type MigrationVerificationCheckStatus = z.infer<
  typeof MigrationVerificationCheckStatusSchema
>;
export type MigrationVerificationSeverity = z.infer<typeof MigrationVerificationSeveritySchema>;
export type MigrationVerificationCheck = z.infer<typeof MigrationVerificationCheckSchema>;
export type MigrationVerificationReport = z.infer<typeof MigrationVerificationReportSchema>;
