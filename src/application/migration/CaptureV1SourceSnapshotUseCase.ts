import type { V1SourceStoragePort } from '../../ports';
import type { MigrationSourceSnapshot } from '../../schemas/v1';
import {
  MigrationSourceSnapshotUseCase,
  type CaptureMigrationSourceSnapshotInput,
} from './MigrationSourceSnapshotUseCase';

export interface CaptureV1SourceSnapshotDependencies {
  sourceStorage: V1SourceStoragePort;
  snapshot: MigrationSourceSnapshotUseCase;
}

export type CaptureV1SourceSnapshotInput = Omit<
  CaptureMigrationSourceSnapshotInput,
  'indexedDb' | 'localStorage' | 'sourceAppVersion' | 'dataSchemaVersion' | 'wordStorageVersion'
> & {
  sourceAppVersion?: string | null;
  dataSchemaVersion?: number | null;
  wordStorageVersion?: number | null;
};

/**
 * Application composition for a complete v1 source capture.
 *
 * The storage adapter only reads browser values; the existing snapshot use
 * case remains responsible for canonicalization, redaction and digests.
 */
export class CaptureV1SourceSnapshotUseCase {
  constructor(private readonly dependencies: CaptureV1SourceSnapshotDependencies) {}

  async capture(input: CaptureV1SourceSnapshotInput): Promise<MigrationSourceSnapshot> {
    const source = await this.dependencies.sourceStorage.read();

    return this.dependencies.snapshot.capture({
      ...input,
      indexedDb: source.indexedDb,
      localStorage: source.localStorage,
      sourceAppVersion:
        input.sourceAppVersion !== undefined ? input.sourceAppVersion : source.sourceAppVersion,
      dataSchemaVersion:
        input.dataSchemaVersion !== undefined ? input.dataSchemaVersion : source.dataSchemaVersion,
      wordStorageVersion:
        input.wordStorageVersion !== undefined
          ? input.wordStorageVersion
          : source.wordStorageVersion,
    });
  }
}
