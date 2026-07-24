import {
  MigrationPreviewUseCase,
  MigrationStagingUseCase,
  type PreviewV1BackupInput,
  type StageV1BackupInput,
} from '../application/migration';
import { webClock, webTextDigest } from '../infrastructure/system';
import type { StageMigrationResult } from '../ports';
import type { MigrationPreviewReport } from '../schemas/v1';
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

export function previewV1Backup(input: PreviewV1BackupInput): Promise<MigrationPreviewReport> {
  return migrationPreviewUseCase.preview(input);
}

export function serializeMigrationPreview(report: MigrationPreviewReport): string {
  return migrationPreviewUseCase.serialize(report);
}

export function stageV1Backup(input: StageV1BackupInput): Promise<StageMigrationResult> {
  return migrationStagingUseCase.stage(input);
}
