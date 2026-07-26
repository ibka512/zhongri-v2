import {
  CaptureV1SourceSnapshotUseCase,
  MigrationDomainSliceStagingUseCase,
  MigrationPreviewUseCase,
  MigrationSourceSnapshotUseCase,
  MigrationStagingUseCase,
  type PreviewV1BackupInput,
  type StageV1BackupInput,
  type CaptureV1SourceSnapshotInput,
} from '../application/migration';
import { jpStudyCanonicalCorpusManifest } from '../content';
import { createCanonicalContentRepository } from './content';
import { BrowserV1SourceStorage } from '../infrastructure/migration';
import { webClock, webTextDigest } from '../infrastructure/system';
import type { StageMigrationResult } from '../ports';
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

export function previewV1Backup(input: PreviewV1BackupInput): Promise<MigrationPreviewReport> {
  return migrationPreviewUseCase.preview(input);
}

export function serializeMigrationPreview(report: MigrationPreviewReport): string {
  return migrationPreviewUseCase.serialize(report);
}

export function stageV1Backup(input: StageV1BackupInput): Promise<StageMigrationResult> {
  return migrationStagingUseCase.stage(input);
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

export function captureV1SourceSnapshot(
  input: CaptureV1SourceSnapshotInput,
): Promise<MigrationSourceSnapshot> {
  return migrationSourceSnapshotUseCase.capture(input);
}
