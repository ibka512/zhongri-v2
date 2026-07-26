export {
  QuestionAudioSchema,
  QuestionMetadataSchema,
  QuestionOptionSchema,
  QuestionPromptSchema,
  QuestionSchema,
  QuestionType,
  QuestionTypeSchema,
} from './QuestionSchema';
export type {
  Question,
  QuestionAudio,
  QuestionMetadata,
  QuestionOption,
  QuestionPrompt,
} from './QuestionSchema';

export {
  JudgementErrorReasonSchema,
  JudgementResultSchema,
  JudgementStatus,
  JudgementStatusSchema,
} from './JudgementSchema';
export type {
  JudgementErrorReason,
  JudgementResult,
  JudgementStatus as JudgementStatusType,
} from './JudgementSchema';

export {
  EventType,
  EventTypeSchema,
  LearningEventPayloadSchema,
  LearningEventSchema,
} from './LearningEventSchema';
export type {
  EventType as EventTypeValue,
  LearningEvent,
  LearningEventPayload,
} from './LearningEventSchema';

export {
  StudySessionCheckpointSchema,
  type StudySessionCheckpoint,
} from './StudySessionCheckpointSchema';
export {
  StudySessionItemReferenceSchema,
  StudySessionStateSchema,
  StudySessionStatusSchema,
  type StudySessionState,
  type StudySessionStatusValue,
} from './StudySessionStateSchema';

export {
  MigrationDomainSummarySchema,
  MigrationIssueSeveritySchema,
  MigrationPreviewAssumptionSchema,
  MigrationPreviewDomainSchema,
  MigrationPreviewIssueSchema,
  MigrationPreviewReportSchema,
  MigrationPreviewSourceSchema,
  MigrationPreviewStatusSchema,
  MigrationPreviewTotalsSchema,
  type MigrationDomainSummary,
  type MigrationPreviewDomain,
  type MigrationPreviewIssue,
  type MigrationPreviewReport,
  type MigrationPreviewStatus,
} from './MigrationPreviewReportSchema';

export {
  ActiveMigrationDatasetPointerSchema,
  MigrationPhaseSchema,
  MigrationRunSchema,
  MigrationRunStatusSchema,
  MigrationStagingDatasetSchema,
  MigrationValidationSummarySchema,
  type ActiveMigrationDatasetPointer,
  type MigrationPhase,
  type MigrationRun,
  type MigrationRunStatus,
  type MigrationStagingDataset,
  type MigrationValidationSummary,
} from './MigrationStagingSchema';

export {
  MigrationSelectedBackupSchema,
  MigrationSensitiveKeyPresenceSchema,
  MigrationSourceSnapshotEntrySchema,
  MigrationSourceSnapshotSchema,
  type MigrationSelectedBackup,
  type MigrationSensitiveKeyPresence,
  type MigrationSourceSnapshot,
  type MigrationSourceSnapshotEntry,
} from './MigrationSourceSnapshotSchema';

export {
  MigrationIdentityMapConfidenceSchema,
  MigrationIdentityMapEntrySchema,
  MigrationIdentityMapInputSchema,
  MigrationIdentityMapOutcomeSchema,
  MigrationIdentityMapQuarantineCodeSchema,
  MigrationIdentityMapReasonSchema,
  MigrationIdentityMapResolutionSchema,
  MigrationIdentityMapSchema,
  MigrationIdentityMapRecordInputSchema,
  MigrationIdentitySourceKindSchema,
  type MigrationIdentityMap,
  type MigrationIdentityMapConfidence,
  type MigrationIdentityMapEntry,
  type MigrationIdentityMapInput,
  type MigrationIdentityMapOutcome,
  type MigrationIdentityMapQuarantineCode,
  type MigrationIdentityMapReason,
  type MigrationIdentityMapRecordInput,
  type MigrationIdentityMapResolution,
  type MigrationIdentitySourceKind,
} from './MigrationIdentityMapSchema';

export {
  MigrationDispositionArchiveKindSchema,
  MigrationDispositionEntrySchema,
  MigrationDispositionInputRecordSchema,
  MigrationDispositionInputSchema,
  MigrationDispositionOutcomeSchema,
  MigrationDispositionReportSchema,
  MigrationDispositionSeveritySchema,
  type MigrationDispositionArchiveKind,
  type MigrationDispositionEntry,
  type MigrationDispositionInput,
  type MigrationDispositionInputRecord,
  type MigrationDispositionOutcome,
  type MigrationDispositionReport,
  type MigrationDispositionSeverity,
} from './MigrationDispositionSchema';

export {
  MigrationIsolatedArchiveSchema,
  MigrationDomainSliceResultSchema,
  MigrationIsolatedFavoriteSchema,
  MigrationIsolatedFsrsCardSchema,
  MigrationIsolatedFsrsLogSchema,
  MigrationIsolatedFolderSchema,
  MigrationIsolatedGroupProgressSchema,
  MigrationIsolatedMasterySchema,
  MigrationIsolatedOverrideSchema,
  MigrationIsolatedPayloadSchema,
  MigrationIsolatedRecycleBinItemSchema,
  MigrationIsolatedAiConversationMessageSchema,
  MigrationIsolatedAiConversationSchema,
  MigrationIsolatedAiQuizAnswerSchema,
  MigrationIsolatedAiQuizSchema,
  MigrationIsolatedPreferenceSchema,
  MigrationIsolatedReminderSettingSchema,
  MigrationIsolatedStudyRecordSchema,
  MigrationIsolatedWrongAnswerSchema,
  MigrationIsolatedWrongBookSchema,
  MigrationIsolatedWordSchema,
  type MigrationDomainSliceResult,
  type MigrationIsolatedArchive,
  type MigrationIsolatedFavorite,
  type MigrationIsolatedFsrsCard,
  type MigrationIsolatedFsrsLog,
  type MigrationIsolatedFolder,
  type MigrationIsolatedGroupProgress,
  type MigrationIsolatedMastery,
  type MigrationIsolatedOverride,
  type MigrationIsolatedPayload,
  type MigrationIsolatedRecycleBinItem,
  type MigrationIsolatedAiConversationMessage,
  type MigrationIsolatedAiConversation,
  type MigrationIsolatedAiQuizAnswer,
  type MigrationIsolatedAiQuiz,
  type MigrationIsolatedPreference,
  type MigrationIsolatedReminderSetting,
  type MigrationIsolatedStudyRecord,
  type MigrationIsolatedWrongAnswer,
  type MigrationIsolatedWrongBook,
  type MigrationIsolatedWord,
} from './MigrationDomainSliceSchema';

export {
  MigrationArchiveRecordSchema,
  MigrationArchiveRetentionPolicySchema,
  type MigrationArchiveRecord,
  type MigrationArchiveRetentionPolicy,
} from './MigrationArchiveSchema';

export {
  MigrationVerificationCheckIdSchema,
  MigrationVerificationCheckSchema,
  MigrationVerificationCheckStatusSchema,
  MigrationVerificationReportSchema,
  MigrationVerificationSeveritySchema,
  migrationVerificationCheckIds,
  type MigrationVerificationCheck,
  type MigrationVerificationCheckId,
  type MigrationVerificationCheckStatus,
  type MigrationVerificationReport,
  type MigrationVerificationSeverity,
} from './MigrationVerificationSchema';

export {
  MAX_MIGRATION_LEGACY_SOURCE_RECORDS,
  MAX_MIGRATION_LEGACY_SOURCE_TEXT_LENGTH,
  MigrationLegacySourceCountsSchema,
  MigrationLegacySourceDomainCountSchema,
  MigrationLegacySourceFormatSchema,
  MigrationLegacySourceOriginSchema,
  MigrationLegacySourceReaderInputSchema,
  MigrationLegacySourceRecordSchema,
  MigrationLegacySourceSchema,
  MigrationLegacySourceValueTypeSchema,
  MigrationSourceSelectionSchema,
  MigrationStorageDivergenceSchema,
  migrationLegacySourceDomainOrder,
  type MigrationLegacySource,
  type MigrationLegacySourceCounts,
  type MigrationLegacySourceDomainCount,
  type MigrationLegacySourceFormat,
  type MigrationLegacySourceOrigin,
  type MigrationLegacySourceReaderInput,
  type MigrationLegacySourceRecord,
  type MigrationLegacySourceValueType,
  type MigrationSourceSelection,
  type MigrationStorageDivergence,
} from './MigrationLegacySourceSchema';

export {
  CanonicalCorpusAcceptanceTargetSchema,
  CanonicalCorpusManifestSchema,
  CanonicalManifestSchema,
  CanonicalWordSchema,
  CanonicalManifestSourceSchema,
  CanonicalWordSourceSchema,
  canonicalCorpusV1AcceptanceTarget,
  type CanonicalCorpusAcceptanceTarget,
  type CanonicalCorpusManifest,
  type CanonicalManifest,
  type CanonicalWord,
} from './CanonicalContentSchema';

export {
  TodayPlanItemSchema,
  TodayPlanSchema,
  type TodayPlan,
  type TodayPlanItem,
} from './TodayPlanSchema';

export {
  LearnerProfileSchema,
  LearnerTrendSchema,
  LearningProjectionSchema,
  ReviewStateSchema,
  type LearnerProfile,
  type LearnerTrend,
  type LearningProjection,
  type ReviewState,
} from './LearningProjectionSchema';

export { AnswerValueSchema, ContractVersionSchema, LanguageSchema } from './shared';
export type { AnswerValue, Language } from './shared';
