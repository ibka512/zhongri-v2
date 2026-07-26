import type {
  CanonicalContentRepositoryPort,
  MigrationPersistencePort,
  StageMigrationResult,
  TextDigestPort,
} from '../../ports';
import type {
  MigrationDomainSliceResult,
  MigrationLegacySource,
  MigrationPreviewReport,
  MigrationSourceSnapshot,
  MigrationSourceSelection,
} from '../../schemas/v1';
import { MigrationDomainSliceUseCase } from './MigrationDomainSliceUseCase';
import { MigrationLegacySourceReaderUseCase } from './MigrationLegacySourceReaderUseCase';
import { MigrationStagingUseCase, prepareV1MigrationSource } from './MigrationStagingUseCase';

export interface MigrationDomainSliceStagingDependencies {
  content: CanonicalContentRepositoryPort;
  digest: TextDigestPort;
  now: () => Date;
  persistence: MigrationPersistencePort;
}

export interface StageMigrationDomainSliceInput {
  report: MigrationPreviewReport;
  text: string;
  sourceSnapshot?: MigrationSourceSnapshot | null;
  sourceSelection?: MigrationSourceSelection;
}

export interface StageMigrationDomainSliceResult {
  source: MigrationLegacySource;
  slice: MigrationDomainSliceResult;
  staging: StageMigrationResult;
}

function createMigrationId(sourceFingerprint: string): string {
  return `v1-v2:${sourceFingerprint.slice(0, 24)}:spec-1`;
}

export class MigrationDomainSliceStagingUseCase {
  constructor(private readonly dependencies: MigrationDomainSliceStagingDependencies) {}

  async stage(input: StageMigrationDomainSliceInput): Promise<StageMigrationDomainSliceResult> {
    const prepared = await prepareV1MigrationSource(input, this.dependencies);
    const migrationId = createMigrationId(prepared.sourceFingerprint);
    const source = await new MigrationLegacySourceReaderUseCase({
      digest: this.dependencies.digest,
    }).read({
      migrationId,
      sourceFingerprint: prepared.sourceFingerprint,
      sourceFileName: input.report.source.fileName,
      sanitizedSourceText: prepared.sanitizedSourceText,
      sourceSelection: input.sourceSelection ?? 'backup',
      sourceSnapshot: prepared.sourceSnapshot,
    });
    const slice = await new MigrationDomainSliceUseCase({
      content: this.dependencies.content,
      digest: this.dependencies.digest,
    }).create({ source });
    const staging = await new MigrationStagingUseCase({
      digest: this.dependencies.digest,
      now: this.dependencies.now,
      persistence: this.dependencies.persistence,
    }).stage({
      ...input,
      isolatedDomainSlice: slice.isolatedPayload,
    });

    return {
      source,
      slice,
      staging,
    };
  }
}
