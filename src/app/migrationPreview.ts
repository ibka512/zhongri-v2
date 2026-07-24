import { MigrationPreviewUseCase, type PreviewV1BackupInput } from '../application/migration';
import { webClock, webTextDigest } from '../infrastructure/system';
import type { MigrationPreviewReport } from '../schemas/v1';

const migrationPreviewUseCase = new MigrationPreviewUseCase({
  digest: webTextDigest,
  now: webClock.now,
});

export function previewV1Backup(input: PreviewV1BackupInput): Promise<MigrationPreviewReport> {
  return migrationPreviewUseCase.preview(input);
}

export function serializeMigrationPreview(report: MigrationPreviewReport): string {
  return migrationPreviewUseCase.serialize(report);
}
