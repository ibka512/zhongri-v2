import { jpStudyCanonicalCorpusManifest, loadJpStudyCanonicalWords } from '../content';
import { StaticCanonicalCorpusContentRepository } from '../infrastructure/content';
import { webTextDigest } from '../infrastructure/system';
import type { CanonicalContentIntegrityReport, CanonicalContentRepositoryPort } from '../ports';

export class CanonicalContentIntegrityError extends Error {
  readonly report: CanonicalContentIntegrityReport;

  constructor(report: CanonicalContentIntegrityReport) {
    super(`Canonical content integrity failed: ${report.errors.join('; ')}`);
    this.name = 'CanonicalContentIntegrityError';
    this.report = report;
  }
}

export async function createCanonicalContentRepository(): Promise<CanonicalContentRepositoryPort> {
  const repository = new StaticCanonicalCorpusContentRepository({
    manifest: jpStudyCanonicalCorpusManifest,
    words: await loadJpStudyCanonicalWords(),
    digest: webTextDigest,
  });
  const report = await repository.verifyIntegrity();
  if (!report.valid) {
    throw new CanonicalContentIntegrityError(report);
  }

  return repository;
}
