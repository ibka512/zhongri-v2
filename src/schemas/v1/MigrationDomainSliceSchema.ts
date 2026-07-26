import { z } from 'zod';

import { MigrationDispositionReportSchema } from './MigrationDispositionSchema';
import { MigrationIdentityMapSchema } from './MigrationIdentityMapSchema';
import {
  ContractVersionSchema,
  IdentifierSchema,
  LanguageSchema,
  NonBlankStringSchema,
} from './shared';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const MigrationIdSchema = z.string().regex(/^v1-v2:[a-f0-9]{24}:spec-1$/);
const DatasetIdSchema = z.string().regex(/^dataset:v1-v2:[a-f0-9]{24}:spec-1$/);
const SourceRefSchema = NonBlankStringSchema.max(500);
const WordIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{2,127}$/);

const SourceDigestListSchema = z.array(Sha256Schema).min(1).max(100);
const SourceRefListSchema = z.array(SourceRefSchema).min(1).max(100);

export const MigrationIsolatedWordSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    targetWordId: WordIdSchema,
    targetKind: z.enum(['canonical', 'user']),
    language: LanguageSchema,
    headword: NonBlankStringSchema.max(200),
    reading: NonBlankStringSchema.max(200).nullable(),
    meaning: NonBlankStringSchema.max(2_000).nullable(),
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
  })
  .strict();

export const MigrationIsolatedOverrideSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    targetWordId: WordIdSchema,
    language: LanguageSchema,
    sourceRef: SourceRefSchema,
    sourceRecordDigestSha256: Sha256Schema,
    serializedValue: z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
  })
  .strict();

export const MigrationIsolatedFolderSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    folderId: IdentifierSchema,
    name: NonBlankStringSchema.max(200),
    language: LanguageSchema,
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
  })
  .strict();

export const MigrationIsolatedFavoriteSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    targetWordId: WordIdSchema,
    sourceRef: SourceRefSchema,
    sourceRecordDigestSha256: Sha256Schema,
  })
  .strict();

export const MigrationIsolatedPayloadSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    stagingKind: z.literal('migration-isolated-domain-slice'),
    datasetId: DatasetIdSchema,
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    sourceReaderDigestSha256: Sha256Schema,
    identityMapDigestSha256: Sha256Schema,
    dispositionReportDigestSha256: Sha256Schema,
    words: z.array(MigrationIsolatedWordSchema).max(100_000),
    overrides: z.array(MigrationIsolatedOverrideSchema).max(100_000),
    folders: z.array(MigrationIsolatedFolderSchema).max(100_000),
    favorites: z.array(MigrationIsolatedFavoriteSchema).max(100_000),
    writesPerformed: z.literal(false),
    activePointerUpdated: z.literal(false),
    payloadDigestSha256: Sha256Schema,
  })
  .strict()
  .superRefine((payload, context) => {
    if (payload.datasetId !== `dataset:${payload.migrationId}`) {
      context.addIssue({
        code: 'custom',
        path: ['datasetId'],
        message: 'Isolated domain payload datasetId must be derived from migrationId',
      });
    }

    const wordIds = new Set<string>();
    for (const [index, word] of payload.words.entries()) {
      if (wordIds.has(word.targetWordId)) {
        context.addIssue({
          code: 'custom',
          path: ['words', index, 'targetWordId'],
          message: 'Isolated word payloads must contain one target per word ID',
        });
      }
      wordIds.add(word.targetWordId);
    }

    const folderIds = new Set<string>();
    for (const [index, folder] of payload.folders.entries()) {
      if (folderIds.has(folder.folderId)) {
        context.addIssue({
          code: 'custom',
          path: ['folders', index, 'folderId'],
          message: 'Isolated folder payloads must contain one target per folder ID',
        });
      }
      folderIds.add(folder.folderId);
    }
  });

export const MigrationDomainSliceResultSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    migrationId: MigrationIdSchema,
    sourceFingerprint: Sha256Schema,
    identityMap: MigrationIdentityMapSchema,
    dispositionReport: MigrationDispositionReportSchema,
    isolatedPayload: MigrationIsolatedPayloadSchema,
  })
  .strict()
  .superRefine((result, context) => {
    if (result.identityMap.migrationId !== result.migrationId) {
      context.addIssue({
        code: 'custom',
        path: ['identityMap', 'migrationId'],
        message: 'Identity map migrationId must match the domain slice result',
      });
    }
    if (result.dispositionReport.migrationId !== result.migrationId) {
      context.addIssue({
        code: 'custom',
        path: ['dispositionReport', 'migrationId'],
        message: 'Disposition report migrationId must match the domain slice result',
      });
    }
    if (result.isolatedPayload.migrationId !== result.migrationId) {
      context.addIssue({
        code: 'custom',
        path: ['isolatedPayload', 'migrationId'],
        message: 'Isolated payload migrationId must match the domain slice result',
      });
    }
    if (result.identityMap.sourceFingerprint !== result.sourceFingerprint) {
      context.addIssue({
        code: 'custom',
        path: ['identityMap', 'sourceFingerprint'],
        message: 'Identity map source fingerprint must match the domain slice result',
      });
    }
    if (result.dispositionReport.sourceFingerprint !== result.sourceFingerprint) {
      context.addIssue({
        code: 'custom',
        path: ['dispositionReport', 'sourceFingerprint'],
        message: 'Disposition report source fingerprint must match the domain slice result',
      });
    }
    if (result.isolatedPayload.sourceFingerprint !== result.sourceFingerprint) {
      context.addIssue({
        code: 'custom',
        path: ['isolatedPayload', 'sourceFingerprint'],
        message: 'Isolated payload source fingerprint must match the domain slice result',
      });
    }
    if (result.dispositionReport.identityMapDigestSha256 !== result.identityMap.mapDigestSha256) {
      context.addIssue({
        code: 'custom',
        path: ['dispositionReport', 'identityMapDigestSha256'],
        message: 'Disposition report must bind the identity map digest',
      });
    }
    if (result.isolatedPayload.identityMapDigestSha256 !== result.identityMap.mapDigestSha256) {
      context.addIssue({
        code: 'custom',
        path: ['isolatedPayload', 'identityMapDigestSha256'],
        message: 'Isolated payload must bind the identity map digest',
      });
    }
    if (
      result.isolatedPayload.dispositionReportDigestSha256 !==
      result.dispositionReport.reportDigestSha256
    ) {
      context.addIssue({
        code: 'custom',
        path: ['isolatedPayload', 'dispositionReportDigestSha256'],
        message: 'Isolated payload must bind the disposition report digest',
      });
    }
  });

export type MigrationIsolatedWord = z.infer<typeof MigrationIsolatedWordSchema>;
export type MigrationIsolatedOverride = z.infer<typeof MigrationIsolatedOverrideSchema>;
export type MigrationIsolatedFolder = z.infer<typeof MigrationIsolatedFolderSchema>;
export type MigrationIsolatedFavorite = z.infer<typeof MigrationIsolatedFavoriteSchema>;
export type MigrationIsolatedPayload = z.infer<typeof MigrationIsolatedPayloadSchema>;
export type MigrationDomainSliceResult = z.infer<typeof MigrationDomainSliceResultSchema>;
