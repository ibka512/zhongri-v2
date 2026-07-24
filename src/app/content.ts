import { jaN5StarterManifest, jaN5StarterWords } from '../content';
import { StaticCanonicalContentRepository } from '../infrastructure/content';
import { webTextDigest } from '../infrastructure/system';
import type { CanonicalContentRepositoryPort, CanonicalIntegrityReport } from '../ports';

export class CanonicalContentIntegrityError extends Error {
  readonly report: CanonicalIntegrityReport;

  constructor(report: CanonicalIntegrityReport) {
    super(`Canonical content integrity failed: ${report.errors.join('; ')}`);
    this.name = 'CanonicalContentIntegrityError';
    this.report = report;
  }
}

export async function createCanonicalContentRepository(): Promise<CanonicalContentRepositoryPort> {
  const repository = new StaticCanonicalContentRepository({
    manifest: jaN5StarterManifest,
    words: jaN5StarterWords,
    digest: webTextDigest,
  });
  const report = await repository.verifyIntegrity();
  if (!report.valid) {
    throw new CanonicalContentIntegrityError(report);
  }

  return repository;
}
