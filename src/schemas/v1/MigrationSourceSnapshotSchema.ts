import { z } from 'zod';

import { ContractVersionSchema, NonBlankStringSchema } from './shared';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const MigrationSourceSnapshotEntrySchema = z
  .object({
    key: NonBlankStringSchema.max(500),
    serializedValue: z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
  })
  .strict();

export const MigrationSelectedBackupSchema = z
  .object({
    fileName: NonBlankStringSchema.max(255),
    fileSizeBytes: z.number().int().nonnegative(),
    rawDigestSha256: Sha256Schema,
    sanitizedDigestSha256: Sha256Schema,
    sanitizedText: z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
  })
  .strict();

export const MigrationSensitiveKeyPresenceSchema = z
  .object({
    key: NonBlankStringSchema.max(128),
    present: z.boolean(),
  })
  .strict();

export const MigrationSourceSnapshotSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    snapshotKind: z.literal('v1-source-snapshot'),
    capturedAt: z.string().datetime({ offset: true }),
    sourceAppVersion: NonBlankStringSchema.max(100).nullable(),
    dataSchemaVersion: z.number().int().nonnegative().nullable(),
    wordStorageVersion: z.number().int().nonnegative().nullable(),
    indexedDb: z.array(MigrationSourceSnapshotEntrySchema).max(5_000),
    localStorage: z.array(MigrationSourceSnapshotEntrySchema).max(5_000),
    selectedBackup: MigrationSelectedBackupSchema.nullable(),
    canonicalManifestDigest: Sha256Schema,
    sensitiveKeyPresence: z.array(MigrationSensitiveKeyPresenceSchema).max(20),
    sourceFingerprint: Sha256Schema,
    snapshotDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    for (const [scope, entries] of [
      ['indexedDb', snapshot.indexedDb],
      ['localStorage', snapshot.localStorage],
    ] as const) {
      const keys = new Set<string>();
      for (const [index, entry] of entries.entries()) {
        if (keys.has(entry.key)) {
          context.addIssue({
            code: 'custom',
            path: [scope, index, 'key'],
            message: `${scope} source keys must be unique`,
          });
        }
        keys.add(entry.key);
      }
    }

    const sensitiveKeys = new Set<string>();
    for (const [index, entry] of snapshot.sensitiveKeyPresence.entries()) {
      if (sensitiveKeys.has(entry.key)) {
        context.addIssue({
          code: 'custom',
          path: ['sensitiveKeyPresence', index, 'key'],
          message: 'Sensitive key presence entries must be unique',
        });
      }
      sensitiveKeys.add(entry.key);
    }
  });

export type MigrationSourceSnapshotEntry = z.infer<typeof MigrationSourceSnapshotEntrySchema>;
export type MigrationSelectedBackup = z.infer<typeof MigrationSelectedBackupSchema>;
export type MigrationSensitiveKeyPresence = z.infer<typeof MigrationSensitiveKeyPresenceSchema>;
export type MigrationSourceSnapshot = z.infer<typeof MigrationSourceSnapshotSchema>;
