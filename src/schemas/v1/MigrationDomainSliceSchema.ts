import { z } from 'zod';

import { MigrationDispositionReportSchema } from './MigrationDispositionSchema';
import { MigrationIdentityMapSchema } from './MigrationIdentityMapSchema';
import { MigrationPreviewDomainSchema } from './MigrationPreviewReportSchema';
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
const SerializedValueListSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
  )
  .min(1)
  .max(100);

const MigrationMasteryMissingFieldSchema = z.enum([
  'spelling',
  'reading',
  'listening',
  'meaning',
  'needsReview',
]);

const MigrationStudyEventTypeSchema = z.enum(['DAILY_PUNCH', 'GROUP_COMPLETED', 'UNKNOWN']);
const MigrationStudyQualityFlagSchema = z.enum(['DATE_MISSING', 'DATE_INVALID', 'UNKNOWN_TYPE']);
const MigrationGroupProgressQualityFlagSchema = z.enum(['COUNT_DEFAULTED', 'COUNT_FLOORED']);

const MigrationReviewDimensionSchema = z.enum(['spelling', 'reading', 'listening', 'meaning']);
const MigrationFsrsQualityFlagSchema = z.enum([
  'ELAPSED_DAYS_DEFAULTED',
  'SCHEDULED_DAYS_DEFAULTED',
  'REPS_DEFAULTED',
  'LAPSES_DEFAULTED',
  'LEARNING_STEPS_DEFAULTED',
  'STATE_DEFAULTED',
  'LAST_REVIEW_MISSING',
  'RAW_KEY_REBUILT',
]);

const MigrationIsolatedArchiveKindSchema = z.enum(['rawArchive', 'quarantine']);

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

export const MigrationIsolatedMasterySchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    targetWordId: WordIdSchema,
    language: LanguageSchema,
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
    dimensions: z
      .object({
        spelling: z.boolean(),
        reading: z.boolean(),
        listening: z.boolean(),
        meaning: z.boolean(),
      })
      .strict(),
    needsReview: z.boolean(),
    missingFields: z.array(MigrationMasteryMissingFieldSchema).max(5),
    serializedValues: SerializedValueListSchema,
  })
  .strict();

export const MigrationIsolatedStudyRecordSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    eventId: IdentifierSchema,
    eventType: MigrationStudyEventTypeSchema,
    dateOnly: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    rawDate: z.string().max(200).nullable(),
    groupLabel: z.string().max(200).nullable(),
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
    qualityFlags: z.array(MigrationStudyQualityFlagSchema).max(3),
    serializedValues: SerializedValueListSchema,
  })
  .strict();

export const MigrationIsolatedGroupProgressSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    groupProgressId: IdentifierSchema,
    groupKey: z.string().max(500),
    completionCount: z.number().int().nonnegative(),
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
    qualityFlags: z.array(MigrationGroupProgressQualityFlagSchema).max(3),
    serializedValues: SerializedValueListSchema,
  })
  .strict();

export const MigrationIsolatedFsrsCardSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    reviewCardId: IdentifierSchema,
    targetWordId: WordIdSchema,
    language: LanguageSchema,
    dimension: MigrationReviewDimensionSchema,
    rawKey: SourceRefSchema,
    due: z.string().datetime({ offset: true }),
    stability: z.number().finite().nonnegative(),
    difficulty: z.number().finite(),
    elapsedDays: z.number().finite().nonnegative(),
    scheduledDays: z.number().finite().nonnegative(),
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    learningSteps: z.number().int().nonnegative(),
    state: z.number().int().nonnegative(),
    lastReviewedAt: z.string().datetime({ offset: true }).nullable(),
    algorithm: z.literal('ts-fsrs@v1-adapter'),
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
    qualityFlags: z.array(MigrationFsrsQualityFlagSchema).max(8),
    serializedValues: SerializedValueListSchema,
  })
  .strict();

export const MigrationIsolatedFsrsLogSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    reviewLogId: IdentifierSchema,
    reviewCardId: IdentifierSchema,
    targetWordId: WordIdSchema,
    language: LanguageSchema,
    dimension: MigrationReviewDimensionSchema,
    rawKey: SourceRefSchema,
    source: z.string().max(100),
    rating: z.number().int().min(1).max(4),
    reviewedAt: z.string().datetime({ offset: true }),
    dueAfter: z.string().datetime({ offset: true }).nullable(),
    sourceRefs: SourceRefListSchema,
    sourceRecordDigestsSha256: SourceDigestListSchema,
    serializedValues: SerializedValueListSchema,
  })
  .strict();

export const MigrationIsolatedArchiveSchema = z
  .object({
    schemaVersion: ContractVersionSchema,
    archiveRef: IdentifierSchema,
    archiveKind: MigrationIsolatedArchiveKindSchema,
    sourceRef: SourceRefSchema,
    domain: MigrationPreviewDomainSchema,
    sourceRecordDigestSha256: Sha256Schema,
    serializedValue: z
      .string()
      .min(1)
      .max(30 * 1024 * 1024),
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
    mastery: z.array(MigrationIsolatedMasterySchema).max(100_000).default([]),
    studyRecords: z.array(MigrationIsolatedStudyRecordSchema).max(100_000).default([]),
    groupProgress: z.array(MigrationIsolatedGroupProgressSchema).max(100_000).default([]),
    fsrsCards: z.array(MigrationIsolatedFsrsCardSchema).max(100_000).default([]),
    fsrsLogs: z.array(MigrationIsolatedFsrsLogSchema).max(100_000).default([]),
    archives: z.array(MigrationIsolatedArchiveSchema).max(200_000).default([]),
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

    const masteryWordIds = new Set<string>();
    for (const [index, mastery] of payload.mastery.entries()) {
      if (masteryWordIds.has(mastery.targetWordId)) {
        context.addIssue({
          code: 'custom',
          path: ['mastery', index, 'targetWordId'],
          message: 'Isolated mastery payloads must contain one merged target per word ID',
        });
      }
      masteryWordIds.add(mastery.targetWordId);
    }

    const reviewCardIds = new Set<string>();
    for (const [index, card] of payload.fsrsCards.entries()) {
      if (reviewCardIds.has(card.reviewCardId)) {
        context.addIssue({
          code: 'custom',
          path: ['fsrsCards', index, 'reviewCardId'],
          message: 'Isolated FSRS card payloads must contain one target per card ID',
        });
      }
      reviewCardIds.add(card.reviewCardId);
    }

    const groupProgressIds = new Set<string>();
    for (const [index, progress] of payload.groupProgress.entries()) {
      if (groupProgressIds.has(progress.groupProgressId)) {
        context.addIssue({
          code: 'custom',
          path: ['groupProgress', index, 'groupProgressId'],
          message: 'Isolated group progress payloads must contain one target per group ID',
        });
      }
      groupProgressIds.add(progress.groupProgressId);
    }

    const studyEventIds = new Set<string>();
    for (const [index, event] of payload.studyRecords.entries()) {
      if (studyEventIds.has(event.eventId)) {
        context.addIssue({
          code: 'custom',
          path: ['studyRecords', index, 'eventId'],
          message: 'Isolated study event payloads must contain one target per event ID',
        });
      }
      studyEventIds.add(event.eventId);
    }

    const reviewLogIds = new Set<string>();
    for (const [index, log] of payload.fsrsLogs.entries()) {
      if (reviewLogIds.has(log.reviewLogId)) {
        context.addIssue({
          code: 'custom',
          path: ['fsrsLogs', index, 'reviewLogId'],
          message: 'Isolated FSRS log payloads must contain one target per log ID',
        });
      }
      reviewLogIds.add(log.reviewLogId);
    }

    const archiveRefs = new Set<string>();
    for (const [index, archive] of payload.archives.entries()) {
      if (archiveRefs.has(archive.archiveRef)) {
        context.addIssue({
          code: 'custom',
          path: ['archives', index, 'archiveRef'],
          message: 'Isolated archives must contain one record per archive reference',
        });
      }
      archiveRefs.add(archive.archiveRef);
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
export type MigrationIsolatedMastery = z.infer<typeof MigrationIsolatedMasterySchema>;
export type MigrationIsolatedStudyRecord = z.infer<typeof MigrationIsolatedStudyRecordSchema>;
export type MigrationIsolatedGroupProgress = z.infer<typeof MigrationIsolatedGroupProgressSchema>;
export type MigrationIsolatedFsrsCard = z.infer<typeof MigrationIsolatedFsrsCardSchema>;
export type MigrationIsolatedFsrsLog = z.infer<typeof MigrationIsolatedFsrsLogSchema>;
export type MigrationIsolatedArchive = z.infer<typeof MigrationIsolatedArchiveSchema>;
export type MigrationIsolatedPayload = z.infer<typeof MigrationIsolatedPayloadSchema>;
export type MigrationDomainSliceResult = z.infer<typeof MigrationDomainSliceResultSchema>;
