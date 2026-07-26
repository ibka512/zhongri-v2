import {
  CaptureV1SourceSnapshotUseCase,
  MigrationDomainSliceStagingUseCase,
  MigrationActivationUseCase,
  MigrationPreviewUseCase,
  MigrationSourceSnapshotUseCase,
  MigrationStagedVerificationUseCase,
  MigrationStagingUseCase,
  type ActivateMigrationInput,
  type PreviewV1BackupInput,
  type StageV1BackupInput,
  type CaptureV1SourceSnapshotInput,
  type VerifyStagedMigrationInput,
  type VerifyStagedMigrationResult,
} from '../application/migration';
import { jpStudyCanonicalCorpusManifest } from '../content';
import { createCanonicalContentRepository } from './content';
import { BrowserV1SourceStorage } from '../infrastructure/migration';
import { webClock, webTextDigest } from '../infrastructure/system';
import type {
  CommitMigrationResult,
  RollbackMigrationResult,
  StageMigrationResult,
} from '../ports';
import type { MigrationPreviewReport, MigrationSourceSnapshot } from '../schemas/v1';
import { appPersistence } from './persistence';

const migrationPreviewUseCase = new MigrationPreviewUseCase({
  digest: webTextDigest,
  now: webClock.now,
});
const migrationStagingUseCase = new MigrationStagingUseCase({
  digest: webTextDigest,
  now: webClock.now,
  persistence: appPersistence,
});
const migrationSourceSnapshotUseCase = new CaptureV1SourceSnapshotUseCase({
  sourceStorage: new BrowserV1SourceStorage(),
  snapshot: new MigrationSourceSnapshotUseCase({
    digest: webTextDigest,
    now: webClock.now,
  }),
});
const migrationActivationUseCase = new MigrationActivationUseCase({
  persistence: appPersistence,
  now: webClock.now,
});

export function previewV1Backup(input: PreviewV1BackupInput): Promise<MigrationPreviewReport> {
  return migrationPreviewUseCase.preview(input);
}

export function serializeMigrationPreview(report: MigrationPreviewReport): string {
  return migrationPreviewUseCase.serialize(report);
}

export async function stageV1Backup(input: StageV1BackupInput): Promise<StageMigrationResult> {
  const content = await createCanonicalContentRepository();
  const staged = await new MigrationDomainSliceStagingUseCase({
    content,
    digest: webTextDigest,
    now: webClock.now,
    persistence: appPersistence,
  }).stage(input);

  return staged.staging;
}

/**
 * Explicit in-place migration entry. The selected backup remains an audit
 * attachment, while the current device snapshot is the source of truth.
 */
export async function stageV1BackupFromCurrentDevice(
  input: StageV1BackupInput,
): Promise<StageMigrationResult> {
  const [content, sourceSnapshot] = await Promise.all([
    createCanonicalContentRepository(),
    migrationSourceSnapshotUseCase.capture({
      selectedBackup: {
        fileName: input.report.source.fileName,
        fileSizeBytes: input.report.source.fileSize,
        text: input.text,
      },
      canonicalManifestDigest: jpStudyCanonicalCorpusManifest.contentSha256,
    }),
  ]);
  const staged = await new MigrationDomainSliceStagingUseCase({
    content,
    digest: webTextDigest,
    now: webClock.now,
    persistence: appPersistence,
  }).stage({
    ...input,
    sourceSnapshot,
    sourceSelection: 'device',
  });

  return staged.staging;
}

/**
 * Rebuilds the isolated payload from the persisted staging source and produces
 * the V01–V25 report. Evidence for acceptance-only checks must be supplied by
 * the caller; this entry never fabricates sampling or rollback evidence.
 */
export async function verifyStagedV1Migration(
  input: VerifyStagedMigrationInput,
): Promise<VerifyStagedMigrationResult> {
  const content = await createCanonicalContentRepository();
  return new MigrationStagedVerificationUseCase({
    content,
    digest: webTextDigest,
    persistence: appPersistence,
  }).verify(input);
}

export function activateStagedV1Migration(
  input: ActivateMigrationInput,
): Promise<CommitMigrationResult> {
  return migrationActivationUseCase.activate(input);
}

export function rollbackStagedV1Migration(migrationId: string): Promise<RollbackMigrationResult> {
  return migrationStagingUseCase.rollback(migrationId);
}

export function captureV1SourceSnapshot(
  input: CaptureV1SourceSnapshotInput,
): Promise<MigrationSourceSnapshot> {
  return migrationSourceSnapshotUseCase.capture(input);
}
