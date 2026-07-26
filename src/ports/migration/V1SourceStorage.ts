export const V1_SOURCE_DATABASE_NAME = 'keyval-store';
export const V1_SOURCE_OBJECT_STORE_NAME = 'keyval';
export const V1_STORAGE_PROBE_KEY = 'zhongri_storage_probe';

export interface V1SourceStorageEntry {
  key: string;
  value: unknown;
}

export interface V1SourceStorageSnapshot {
  indexedDb: readonly V1SourceStorageEntry[];
  localStorage: readonly V1SourceStorageEntry[];
  sourceAppVersion?: string | null;
  dataSchemaVersion?: number | null;
  wordStorageVersion?: number | null;
}

/**
 * Read-only boundary for the legacy v1 browser storage.
 *
 * The port returns raw values. Stable serialization, redaction and source
 * identity remain application concerns so the same contract can be tested
 * without a browser.
 */
export interface V1SourceStoragePort {
  read: () => Promise<V1SourceStorageSnapshot>;
}
