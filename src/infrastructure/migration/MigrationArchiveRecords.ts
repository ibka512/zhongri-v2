import {
  MigrationArchiveRecordSchema,
  MigrationStagingDatasetSchema,
  type MigrationArchiveRecord,
  type MigrationStagingDataset,
} from '../../schemas/v1';

function compareArchiveRefs(left: MigrationArchiveRecord, right: MigrationArchiveRecord): number {
  return left.archiveRef < right.archiveRef ? -1 : left.archiveRef > right.archiveRef ? 1 : 0;
}

export function createMigrationArchiveRecords(
  input: MigrationStagingDataset,
): readonly MigrationArchiveRecord[] {
  const dataset = MigrationStagingDatasetSchema.parse(input);
  const archives = dataset.isolatedDomainSlice?.archives ?? [];

  return archives
    .map((archive) =>
      MigrationArchiveRecordSchema.parse({
        ...archive,
        migrationId: dataset.migrationId,
        datasetId: dataset.datasetId,
        createdAt: dataset.createdAt,
        retentionPolicy: 'stable-version-cycle',
        retentionUntil: null,
        cleanupConfirmedAt: null,
      }),
    )
    .sort(compareArchiveRefs);
}
