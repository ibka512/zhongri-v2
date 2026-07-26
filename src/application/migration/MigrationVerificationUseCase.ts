import type { CanonicalContentRepositoryPort, TextDigestPort } from '../../ports';
import {
  MigrationDomainSliceResultSchema,
  MigrationLegacySourceSchema,
  MigrationVerificationCheckSchema,
  MigrationVerificationReportSchema,
  MigrationRollbackDrillEvidenceSchema,
  MigrationSamplingEvidenceSchema,
  migrationVerificationCheckIds,
  type MigrationDomainSliceResult,
  type MigrationLegacySource,
  type MigrationRollbackDrillEvidence,
  type MigrationSamplingEvidence,
  type MigrationPreviewDomain,
  type MigrationVerificationCheck,
  type MigrationVerificationReport,
} from '../../schemas/v1';

export interface MigrationVerificationDependencies {
  content: CanonicalContentRepositoryPort;
  digest: TextDigestPort;
}

export interface CreateMigrationVerificationInput {
  source: MigrationLegacySource;
  slice: MigrationDomainSliceResult;
  replaySlice?: MigrationDomainSliceResult | null;
  samplingEvidence?: MigrationSamplingEvidence | null;
  rollbackDrillEvidence?: MigrationRollbackDrillEvidence | null;
}

export class MigrationVerificationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationVerificationInputError';
  }
}

const DOMAIN_CHECKS: ReadonlyMap<
  string,
  { domain: MigrationPreviewDomain; payloadCount: (slice: MigrationDomainSliceResult) => number }
> = new Map([
  ['V03', { domain: 'words', payloadCount: (slice) => slice.isolatedPayload.words.length }],
  ['V04', { domain: 'overrides', payloadCount: (slice) => slice.isolatedPayload.overrides.length }],
  ['V05', { domain: 'favorites', payloadCount: (slice) => slice.isolatedPayload.favorites.length }],
  ['V06', { domain: 'folders', payloadCount: (slice) => slice.isolatedPayload.folders.length }],
  ['V07', { domain: 'mastery', payloadCount: (slice) => slice.isolatedPayload.mastery.length }],
  ['V08', { domain: 'mastery', payloadCount: (slice) => slice.isolatedPayload.mastery.length }],
  [
    'V09',
    { domain: 'studyRecords', payloadCount: (slice) => slice.isolatedPayload.studyRecords.length },
  ],
  [
    'V10',
    {
      domain: 'groupProgress',
      payloadCount: (slice) => slice.isolatedPayload.groupProgress.length,
    },
  ],
  ['V11', { domain: 'fsrsCards', payloadCount: (slice) => slice.isolatedPayload.fsrsCards.length }],
  ['V12', { domain: 'fsrsLogs', payloadCount: (slice) => slice.isolatedPayload.fsrsLogs.length }],
  ['V13', { domain: 'wrongBook', payloadCount: (slice) => slice.isolatedPayload.wrongBook.length }],
  [
    'V14',
    {
      domain: 'aiConversations',
      payloadCount: (slice) => slice.isolatedPayload.aiConversations.length,
    },
  ],
  [
    'V15',
    {
      domain: 'aiQuizHistory',
      payloadCount: (slice) => slice.isolatedPayload.aiQuizHistory.length,
    },
  ],
  [
    'V16',
    { domain: 'recycleBin', payloadCount: (slice) => slice.isolatedPayload.recycleBin.length },
  ],
  [
    'V17',
    { domain: 'preferences', payloadCount: (slice) => slice.isolatedPayload.preferences.length },
  ],
]);

function jsonText(value: unknown): string {
  return JSON.stringify(value);
}

function makeCheck(
  checkId: MigrationVerificationCheck['checkId'],
  status: MigrationVerificationCheck['status'],
  severity: MigrationVerificationCheck['severity'],
  reasonCode: string,
  message: string,
  expected: unknown = null,
  observed: unknown = null,
): MigrationVerificationCheck {
  return MigrationVerificationCheckSchema.parse({
    schemaVersion: 1,
    checkId,
    status,
    severity,
    reasonCode,
    message,
    expected: expected === null ? null : jsonText(expected),
    observed: observed === null ? null : jsonText(observed),
  });
}

function domainConservationCheck(
  checkId: MigrationVerificationCheck['checkId'],
  source: MigrationLegacySource,
  slice: MigrationDomainSliceResult,
  domain: MigrationPreviewDomain,
  payloadCount: number,
): MigrationVerificationCheck {
  const sourceCount = source.records.filter((record) => record.domain === domain).length;
  const dispositionCount = slice.dispositionReport.entries.filter(
    (entry) => entry.domain === domain,
  ).length;
  const passed = sourceCount === dispositionCount;
  return makeCheck(
    checkId,
    passed ? 'passed' : 'failed',
    passed ? 'info' : 'blocking',
    passed ? 'DOMAIN_COUNT_CONSERVED' : 'DOMAIN_COUNT_MISMATCH',
    passed
      ? `${domain} 的每条来源记录都有 disposition 去向。`
      : `${domain} 的来源记录与 disposition 数量不一致。`,
    { sourceRecords: sourceCount, dispositionRecords: sourceCount },
    {
      sourceRecords: sourceCount,
      dispositionRecords: dispositionCount,
      payloadRecords: payloadCount,
    },
  );
}

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function collectInvalidTimes(slice: MigrationDomainSliceResult): string[] {
  const payload = slice.isolatedPayload;
  const invalid: string[] = [];
  for (const event of payload.studyRecords) {
    if (event.dateOnly && !isValidDateOnly(event.dateOnly)) {
      invalid.push(`studyRecords:${event.eventId}.dateOnly`);
    }
  }
  for (const mistake of payload.wrongBook) {
    for (const answer of mistake.recentAnswers) {
      if (answer.occurredAt && Number.isNaN(Date.parse(answer.occurredAt))) {
        invalid.push(`wrongBook:${mistake.mistakeRecordId}.recentAnswers`);
      }
    }
    for (const [field, value] of [
      ['lastWrongAt', mistake.lastWrongAt],
      ['lastCorrectAt', mistake.lastCorrectAt],
    ] as const) {
      if (value && Number.isNaN(Date.parse(value))) {
        invalid.push(`wrongBook:${mistake.mistakeRecordId}.${field}`);
      }
    }
  }
  for (const item of payload.recycleBin) {
    for (const [field, value] of [
      ['deletedAt', item.deletedAt],
      ['expiresAt', item.expiresAt],
    ] as const) {
      if (value && Number.isNaN(Date.parse(value))) {
        invalid.push(`recycleBin:${item.itemId}.${field}`);
      }
    }
  }
  for (const conversation of payload.aiConversations) {
    if (conversation.updatedAt && Number.isNaN(Date.parse(conversation.updatedAt))) {
      invalid.push(`aiConversations:${conversation.conversationId}.updatedAt`);
    }
  }
  for (const quiz of payload.aiQuizHistory) {
    if (quiz.createdAt && Number.isNaN(Date.parse(quiz.createdAt))) {
      invalid.push(`aiQuizHistory:${quiz.quizId}.createdAt`);
    }
  }
  for (const card of payload.fsrsCards) {
    if (Number.isNaN(Date.parse(card.due))) {
      invalid.push(`fsrsCards:${card.reviewCardId}.due`);
    }
    if (card.lastReviewedAt && Number.isNaN(Date.parse(card.lastReviewedAt))) {
      invalid.push(`fsrsCards:${card.reviewCardId}.lastReviewedAt`);
    }
  }
  for (const log of payload.fsrsLogs) {
    if (Number.isNaN(Date.parse(log.reviewedAt))) {
      invalid.push(`fsrsLogs:${log.reviewLogId}.reviewedAt`);
    }
    if (log.dueAfter && Number.isNaN(Date.parse(log.dueAfter))) {
      invalid.push(`fsrsLogs:${log.reviewLogId}.dueAfter`);
    }
  }
  return invalid;
}

function collectUnresolvedReferences(slice: MigrationDomainSliceResult): string[] {
  const payload = slice.isolatedPayload;
  const wordIds = new Set(payload.words.map((word) => word.targetWordId));
  const cardIds = new Set(payload.fsrsCards.map((card) => card.reviewCardId));
  const unresolved: string[] = [];
  for (const favorite of payload.favorites) {
    if (!wordIds.has(favorite.targetWordId)) {
      unresolved.push(`favorites:${favorite.targetWordId}`);
    }
  }
  for (const mastery of payload.mastery) {
    if (!wordIds.has(mastery.targetWordId)) {
      unresolved.push(`mastery:${mastery.targetWordId}`);
    }
  }
  for (const mistake of payload.wrongBook) {
    if (!wordIds.has(mistake.targetWordId)) {
      unresolved.push(`wrongBook:${mistake.mistakeRecordId}`);
    }
  }
  for (const item of payload.recycleBin) {
    if (item.resolvedTargetWordId && !wordIds.has(item.resolvedTargetWordId)) {
      unresolved.push(`recycleBin:${item.itemId}`);
    }
  }
  for (const conversation of payload.aiConversations) {
    if (conversation.resolvedTargetWordId && !wordIds.has(conversation.resolvedTargetWordId)) {
      unresolved.push(`aiConversations:${conversation.conversationId}`);
    }
  }
  for (const quiz of payload.aiQuizHistory) {
    for (const [index, answer] of quiz.answers.entries()) {
      if (answer.resolvedTargetWordId && !wordIds.has(answer.resolvedTargetWordId)) {
        unresolved.push(`aiQuizHistory:${quiz.quizId}.answers[${index}]`);
      }
    }
  }
  for (const card of payload.fsrsCards) {
    if (!wordIds.has(card.targetWordId)) {
      unresolved.push(`fsrsCards:${card.reviewCardId}`);
    }
  }
  for (const log of payload.fsrsLogs) {
    if (!wordIds.has(log.targetWordId) || !cardIds.has(log.reviewCardId)) {
      unresolved.push(`fsrsLogs:${log.reviewLogId}`);
    }
  }
  return unresolved;
}

function findDuplicateKeys(slice: MigrationDomainSliceResult): string[] {
  const payload = slice.isolatedPayload;
  const collections: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['words', payload.words.map((word) => word.targetWordId)],
    ['overrides', payload.overrides.map((override) => override.targetWordId)],
    ['folders', payload.folders.map((folder) => folder.folderId)],
    ['studyRecords', payload.studyRecords.map((event) => event.eventId)],
    ['groupProgress', payload.groupProgress.map((entry) => entry.groupProgressId)],
    ['wrongBook', payload.wrongBook.map((entry) => entry.mistakeRecordId)],
    ['recycleBin', payload.recycleBin.map((entry) => entry.itemId)],
    ['aiConversations', payload.aiConversations.map((entry) => entry.conversationId)],
    ['aiQuizHistory', payload.aiQuizHistory.map((entry) => entry.quizId)],
    ['preferences', payload.preferences.map((entry) => entry.preferenceKey)],
    ['fsrsCards', payload.fsrsCards.map((entry) => entry.reviewCardId)],
    ['fsrsLogs', payload.fsrsLogs.map((entry) => entry.reviewLogId)],
    ['archives', payload.archives.map((entry) => entry.archiveRef)],
  ];
  const duplicates: string[] = [];
  for (const [name, keys] of collections) {
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) {
        duplicates.push(`${name}:${key}`);
      }
      seen.add(key);
    }
  }
  return duplicates;
}

function isReminderSourceRef(sourceRef: string): boolean {
  return [
    'nativeStudyReminderSettingsV2',
    'nativeStudyReminderEnabled',
    'nativeStudyReminderTime',
  ].some((key) => sourceRef.endsWith(`["${key}"]`));
}

export class MigrationVerificationUseCase {
  constructor(private readonly dependencies: MigrationVerificationDependencies) {}

  async create(input: CreateMigrationVerificationInput): Promise<MigrationVerificationReport> {
    let source: MigrationLegacySource;
    let slice: MigrationDomainSliceResult;
    try {
      source = MigrationLegacySourceSchema.parse(input.source);
      slice = MigrationDomainSliceResultSchema.parse(input.slice);
    } catch {
      throw new MigrationVerificationInputError('迁移验证输入不符合 v1 合约。');
    }
    if (
      source.migrationId !== slice.migrationId ||
      source.sourceFingerprint !== slice.sourceFingerprint
    ) {
      throw new MigrationVerificationInputError(
        'source 与 isolated domain slice 的迁移身份不一致。',
      );
    }

    let replaySlice: MigrationDomainSliceResult | null = null;
    if (input.replaySlice) {
      try {
        replaySlice = MigrationDomainSliceResultSchema.parse(input.replaySlice);
      } catch {
        throw new MigrationVerificationInputError('replay isolated domain slice 不符合 v1 合约。');
      }
      if (
        replaySlice.migrationId !== slice.migrationId ||
        replaySlice.sourceFingerprint !== slice.sourceFingerprint
      ) {
        throw new MigrationVerificationInputError('replay slice 的迁移身份不一致。');
      }
    }

    let samplingEvidence: MigrationSamplingEvidence | null = null;
    if (input.samplingEvidence) {
      try {
        samplingEvidence = MigrationSamplingEvidenceSchema.parse(input.samplingEvidence);
      } catch {
        throw new MigrationVerificationInputError('固定抽样证据不符合 v1 迁移契约。');
      }
    }

    let rollbackDrillEvidence: MigrationRollbackDrillEvidence | null = null;
    if (input.rollbackDrillEvidence) {
      try {
        rollbackDrillEvidence = MigrationRollbackDrillEvidenceSchema.parse(
          input.rollbackDrillEvidence,
        );
      } catch {
        throw new MigrationVerificationInputError('回滚演练证据不符合 v1 迁移契约。');
      }
    }

    const checks = new Map<MigrationVerificationCheck['checkId'], MigrationVerificationCheck>();
    const integrity = await this.dependencies.content.verifyIntegrity();
    const isCorpus = 'expectedTotalWordCount' in integrity;
    const expectedTotal = isCorpus ? integrity.expectedTotalWordCount : integrity.expectedWordCount;
    const actualTotal = isCorpus ? integrity.actualTotalWordCount : integrity.actualWordCount;
    checks.set(
      'V01',
      makeCheck(
        'V01',
        integrity.valid && expectedTotal === actualTotal ? 'passed' : 'failed',
        'blocking',
        integrity.valid && expectedTotal === actualTotal
          ? 'CANONICAL_COUNT_MATCH'
          : 'CANONICAL_COUNT_MISMATCH',
        '内置 canonical 词条总数与固定 manifest 一致。',
        expectedTotal,
        actualTotal,
      ),
    );
    if (isCorpus) {
      checks.set(
        'V02',
        makeCheck(
          'V02',
          integrity.valid &&
            integrity.expectedLanguageCounts.ja === integrity.actualLanguageCounts.ja &&
            integrity.expectedLanguageCounts.en === integrity.actualLanguageCounts.en
            ? 'passed'
            : 'failed',
          'blocking',
          integrity.valid ? 'CANONICAL_LANGUAGE_COUNTS_MATCH' : 'CANONICAL_LANGUAGE_COUNTS_INVALID',
          '日语/英语 canonical 数量与 manifest 一致。',
          integrity.expectedLanguageCounts,
          integrity.actualLanguageCounts,
        ),
      );
    } else {
      checks.set(
        'V02',
        makeCheck(
          'V02',
          'unverified',
          'blocking',
          'BILINGUAL_CORPUS_REQUIRED',
          '当前 content repository 不是双语 corpus，日英分布尚未验证。',
          { ja: 5906, en: 3922 },
          null,
        ),
      );
    }

    for (const [checkId, definition] of DOMAIN_CHECKS) {
      checks.set(
        checkId as MigrationVerificationCheck['checkId'],
        domainConservationCheck(
          checkId as MigrationVerificationCheck['checkId'],
          source,
          slice,
          definition.domain,
          definition.payloadCount(slice),
        ),
      );
    }

    const reminderSourceRefs = source.records
      .filter((record) => record.domain === 'preferences' && isReminderSourceRef(record.sourceRef))
      .map((record) => record.sourceRef);
    const reminderSetting = slice.isolatedPayload.reminderSettings[0] ?? null;
    const reminderSourcesCovered =
      reminderSetting !== null &&
      reminderSourceRefs.length > 0 &&
      reminderSourceRefs.every((sourceRef) => reminderSetting.sourceRefs.includes(sourceRef));
    checks.set(
      'V18',
      makeCheck(
        'V18',
        reminderSourceRefs.length === 0
          ? 'unverified'
          : reminderSourcesCovered
            ? 'passed'
            : 'failed',
        reminderSourceRefs.length === 0 || reminderSourcesCovered ? 'warning' : 'blocking',
        reminderSourceRefs.length === 0
          ? 'REMINDER_SOURCE_PENDING'
          : reminderSourcesCovered
            ? 'REMINDER_SETTINGS_MAPPED'
            : 'REMINDER_SETTINGS_MISSING',
        reminderSourceRefs.length === 0
          ? '需要设备或真实 backup 的提醒来源才能完成 V18。'
          : reminderSourcesCovered
            ? '提醒来源已归一化为隔离 ReminderSetting，权限保持 unknown。'
            : '提醒来源没有完整映射到隔离 ReminderSetting。',
        'all reminder source refs mapped',
        { sourceRefs: reminderSourceRefs, payload: reminderSetting?.sourceRefs ?? [] },
      ),
    );

    const unresolvedReferences = collectUnresolvedReferences(slice);
    checks.set(
      'V19',
      makeCheck(
        'V19',
        unresolvedReferences.length === 0 ? 'passed' : 'failed',
        'blocking',
        unresolvedReferences.length === 0 ? 'ACTIVE_RELATIONS_RESOLVE' : 'ACTIVE_RELATION_ORPHAN',
        unresolvedReferences.length === 0
          ? 'isolated payload 中的活跃外键都能解析到同一份隔离目标。'
          : 'isolated payload 中存在无法解析的活跃外键。',
        'zero unresolved active references',
        unresolvedReferences.slice(0, 20),
      ),
    );

    const duplicateKeys = findDuplicateKeys(slice);
    const schemaValid = MigrationDomainSliceResultSchema.safeParse(slice).success;
    checks.set(
      'V20',
      makeCheck(
        'V20',
        schemaValid && duplicateKeys.length === 0 ? 'passed' : 'failed',
        'blocking',
        schemaValid && duplicateKeys.length === 0 ? 'PRIMARY_KEYS_UNIQUE' : 'PRIMARY_KEY_DUPLICATE',
        schemaValid && duplicateKeys.length === 0
          ? '所有 isolated 主键和归档引用唯一。'
          : 'isolated payload 存在重复主键或契约不合法。',
        'unique primary keys',
        duplicateKeys.length > 0 ? duplicateKeys.slice(0, 20) : null,
      ),
    );

    const handledSourceCount = source.records.filter(
      (record) => record.domain !== 'unknown',
    ).length;
    const unknownSourceCount = source.records.filter(
      (record) => record.domain === 'unknown',
    ).length;
    const dispositionConserved =
      slice.dispositionReport.counts.source === slice.dispositionReport.entries.length &&
      slice.dispositionReport.counts.migrated +
        slice.dispositionReport.counts.deduped +
        slice.dispositionReport.counts.quarantined ===
        slice.dispositionReport.counts.source &&
      slice.dispositionReport.entries.length === handledSourceCount;
    checks.set(
      'V21',
      makeCheck(
        'V21',
        unknownSourceCount > 0 ? 'unverified' : dispositionConserved ? 'passed' : 'failed',
        unknownSourceCount > 0 || dispositionConserved ? 'warning' : 'blocking',
        unknownSourceCount > 0
          ? 'UNKNOWN_SOURCE_RECORDS_PENDING'
          : dispositionConserved
            ? 'DISPOSITION_CONSERVED'
            : 'DISPOSITION_NOT_CONSERVED',
        unknownSourceCount > 0
          ? 'unknown source records 仍需 archive-only 验收，不能把全量来源宣称为守恒。'
          : dispositionConserved
            ? '所有已支持来源记录都有 migrated/deduped/quarantined 去向。'
            : 'disposition report 没有覆盖所有已支持来源记录。',
        { source: handledSourceCount },
        { disposition: slice.dispositionReport.entries.length, unknown: unknownSourceCount },
      ),
    );

    const invalidTimes = collectInvalidTimes(slice);
    checks.set(
      'V22',
      makeCheck(
        'V22',
        invalidTimes.length === 0 ? 'passed' : 'failed',
        invalidTimes.length === 0 ? 'warning' : 'blocking',
        invalidTimes.length === 0 ? 'ACTIVE_TIMES_VALID' : 'ACTIVE_TIME_INVALID',
        invalidTimes.length === 0
          ? 'isolated payload 中的非空 active 时间可解析。'
          : 'isolated payload 中存在不可解析的时间字段。',
        'all non-null active times parse',
        invalidTimes.length > 0 ? invalidTimes.slice(0, 20) : null,
      ),
    );

    checks.set(
      'V23',
      makeCheck(
        'V23',
        samplingEvidence === null
          ? 'unverified'
          : samplingEvidence.migrationId !== source.migrationId ||
              samplingEvidence.sourceFingerprint !== source.sourceFingerprint
            ? 'failed'
            : samplingEvidence.passed
              ? 'passed'
              : 'failed',
        'warning',
        samplingEvidence === null
          ? 'FIXED_SAMPLE_PENDING'
          : samplingEvidence.migrationId !== source.migrationId ||
              samplingEvidence.sourceFingerprint !== source.sourceFingerprint
            ? 'FIXED_SAMPLE_IDENTITY_MISMATCH'
            : samplingEvidence.passed
              ? 'FIXED_SAMPLE_VERIFIED'
              : 'FIXED_SAMPLE_MISMATCH',
        samplingEvidence === null
          ? '固定 sourceFingerprint 抽样尚未绑定真实 fixture 和抽样证据。'
          : samplingEvidence.migrationId !== source.migrationId ||
              samplingEvidence.sourceFingerprint !== source.sourceFingerprint
            ? '固定抽样证据与当前 source 身份不一致。'
            : samplingEvidence.passed
              ? '固定 sourceFingerprint 抽样的字段与关系绑定已通过。'
              : '固定抽样发现来源记录未绑定到目标或隔离归档。',
        'per-language fixed sample evidence',
        samplingEvidence
          ? {
              evidenceDigestSha256: samplingEvidence.evidenceDigestSha256,
              categories: samplingEvidence.categories.map((category) => ({
                category: category.category,
                availableCount: category.availableCount,
                sampleCount: category.sampleCount,
                mismatchCount: category.mismatchSourceRefs.length,
              })),
            }
          : null,
      ),
    );

    const replayEqual = replaySlice ? JSON.stringify(slice) === JSON.stringify(replaySlice) : null;
    checks.set(
      'V24',
      makeCheck(
        'V24',
        replayEqual === null ? 'unverified' : replayEqual ? 'passed' : 'failed',
        replayEqual === false ? 'blocking' : 'warning',
        replayEqual === null
          ? 'REPLAY_EVIDENCE_REQUIRED'
          : replayEqual
            ? 'REPLAY_DETERMINISTIC'
            : 'REPLAY_CHANGED_PAYLOAD',
        replayEqual === null
          ? '需要同一 source snapshot 的第二次 transformer 结果才能完成 V24。'
          : replayEqual
            ? '同一 source snapshot 的两次 isolated 结果完全一致。'
            : '同一 source snapshot 的两次 isolated 结果不一致。',
        'identical isolated result',
        replayEqual,
      ),
    );

    checks.set(
      'V25',
      makeCheck(
        'V25',
        rollbackDrillEvidence === null
          ? 'unverified'
          : rollbackDrillEvidence.migrationId !== source.migrationId ||
              rollbackDrillEvidence.sourceFingerprint !== source.sourceFingerprint
            ? 'failed'
            : rollbackDrillEvidence.passed
              ? 'passed'
              : 'failed',
        'blocking',
        rollbackDrillEvidence === null
          ? 'ROLLBACK_DRILL_PENDING'
          : rollbackDrillEvidence.migrationId !== source.migrationId ||
              rollbackDrillEvidence.sourceFingerprint !== source.sourceFingerprint
            ? 'ROLLBACK_DRILL_IDENTITY_MISMATCH'
            : rollbackDrillEvidence.passed
              ? 'ROLLBACK_DRILL_VERIFIED'
              : 'ROLLBACK_DRILL_FAILED',
        rollbackDrillEvidence === null
          ? '失败注入、active pointer 原子提交和回滚演练仍需由 persistence 验收层完成。'
          : rollbackDrillEvidence.migrationId !== source.migrationId ||
              rollbackDrillEvidence.sourceFingerprint !== source.sourceFingerprint
            ? '回滚演练证据与当前 source 身份不一致。'
            : rollbackDrillEvidence.passed
              ? 'stage/commit/rollback 失败注入均保持 active pointer 与隔离快照不变。'
              : '回滚演练至少有一个阶段未能证明原子恢复。',
        '100% failure-injection rollback recovery',
        rollbackDrillEvidence
          ? {
              evidenceDigestSha256: rollbackDrillEvidence.evidenceDigestSha256,
              phases: rollbackDrillEvidence.phases.map((phase) => ({
                phase: phase.phase,
                operationRejected: phase.operationRejected,
                activeDatasetIdBefore: phase.activeDatasetIdBefore,
                activeDatasetIdAfter: phase.activeDatasetIdAfter,
                migrationStatusBefore: phase.migrationStatusBefore,
                migrationStatusAfter: phase.migrationStatusAfter,
                passed: phase.passed,
              })),
            }
          : null,
      ),
    );

    const orderedChecks = migrationVerificationCheckIds.map((checkId) => {
      const check = checks.get(checkId);
      if (!check) {
        throw new MigrationVerificationInputError(`缺少验证项 ${checkId}。`);
      }
      return check;
    });
    const blockingCheckIds = orderedChecks
      .filter((check) => check.status !== 'passed' && check.severity === 'blocking')
      .map((check) => check.checkId);
    const reportFields = {
      schemaVersion: 1 as const,
      reportKind: 'v1-migration-verification' as const,
      migrationId: source.migrationId,
      sourceFingerprint: source.sourceFingerprint,
      checks: orderedChecks,
      passed: orderedChecks.every((check) => check.status === 'passed'),
      blockingCheckIds,
    };
    const reportDigestSha256 = await this.dependencies.digest.sha256(JSON.stringify(reportFields));
    if (!/^[a-f0-9]{64}$/.test(reportDigestSha256)) {
      throw new MigrationVerificationInputError('验证报告 digest 不是合法的 SHA-256。');
    }
    return MigrationVerificationReportSchema.parse({ ...reportFields, reportDigestSha256 });
  }
}
