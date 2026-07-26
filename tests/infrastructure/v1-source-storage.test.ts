import 'fake-indexeddb/auto';

import { afterEach, describe, expect, it } from 'vitest';

import {
  BrowserV1SourceStorage,
  V1SourceStorageReadError,
} from '../../src/infrastructure/migration';

const databaseName = 'keyval-store';

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

function openDatabase(storeName = 'keyval'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function seedDatabase(entries: readonly [IDBValidKey, unknown][]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('keyval', 'readwrite');
    const store = transaction.objectStore('keyval');
    for (const [key, value] of entries) {
      store.put(value, key);
    }
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
  database.close();
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

afterEach(async () => {
  await deleteDatabase();
});

describe('BrowserV1SourceStorage', () => {
  it('reads the legacy store without migrating the probe key and exposes version metadata', async () => {
    await seedDatabase([
      ['userWords_v1', [{ _id: 'user-1', word: '猫' }]],
      ['zhongri_storage_probe', { ignored: true }],
      ['wordStorageVersion', 1],
    ]);
    const storage = new MemoryStorage();
    storage.setItem('dataSchemaVersion', '8');
    storage.setItem('wordStorageVersion', '1');
    storage.setItem('deepseekApiKey', 'sk-source-secret');

    const snapshot = await new BrowserV1SourceStorage({
      indexedDB,
      localStorage: storage,
      sourceAppVersion: 'V9.1',
    }).read();

    expect(snapshot).toMatchObject({
      sourceAppVersion: 'V9.1',
      dataSchemaVersion: 8,
      wordStorageVersion: 1,
    });
    expect(snapshot.indexedDb).toEqual([
      { key: 'userWords_v1', value: [{ _id: 'user-1', word: '猫' }] },
      { key: 'wordStorageVersion', value: 1 },
    ]);
    expect(snapshot.localStorage).toContainEqual({
      key: 'deepseekApiKey',
      value: 'sk-source-secret',
    });
  });

  it('does not create a missing IndexedDB database while reading localStorage fallback data', async () => {
    const missingDatabaseName = `missing-${crypto.randomUUID()}`;
    const storage = new MemoryStorage();
    storage.setItem('langMode', 'ja');

    const snapshot = await new BrowserV1SourceStorage({
      indexedDB,
      localStorage: storage,
      databaseName: missingDatabaseName,
    }).read();

    expect(snapshot.indexedDb).toEqual([]);
    expect(snapshot.localStorage).toEqual([{ key: 'langMode', value: 'ja' }]);
    expect(
      (await indexedDB.databases()).some((database) => database.name === missingDatabaseName),
    ).toBe(false);
  });

  it('fails closed for invalid version metadata and non-string IndexedDB keys', async () => {
    const storage = new MemoryStorage();
    storage.setItem('dataSchemaVersion', '8.5');

    await expect(
      new BrowserV1SourceStorage({ indexedDB, localStorage: storage }).read(),
    ).rejects.toMatchObject({ code: 'INVALID_VERSION_METADATA' });

    await deleteDatabase();
    await seedDatabase([[1, { invalid: true }]]);
    const validStorage = new MemoryStorage();
    await expect(
      new BrowserV1SourceStorage({ indexedDB, localStorage: validStorage }).read(),
    ).rejects.toBeInstanceOf(V1SourceStorageReadError);
    await expect(
      new BrowserV1SourceStorage({ indexedDB, localStorage: validStorage }).read(),
    ).rejects.toMatchObject({ code: 'INVALID_INDEXED_DB_KEY' });
  });
});
