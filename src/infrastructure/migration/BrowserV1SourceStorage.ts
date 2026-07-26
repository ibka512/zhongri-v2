import {
  V1_SOURCE_DATABASE_NAME,
  V1_SOURCE_OBJECT_STORE_NAME,
  V1_STORAGE_PROBE_KEY,
  type V1SourceStorageEntry,
  type V1SourceStoragePort,
  type V1SourceStorageSnapshot,
} from '../../ports';

export interface BrowserV1SourceStorageOptions {
  indexedDB?: IDBFactory;
  localStorage?: Storage;
  sourceAppVersion?: string | null;
  databaseName?: string;
  objectStoreName?: string;
}

export class V1SourceStorageReadError extends Error {
  constructor(
    readonly code:
      | 'INDEXED_DB_ENUMERATION_UNSUPPORTED'
      | 'INDEXED_DB_READ_FAILED'
      | 'INDEXED_DB_STORE_MISSING'
      | 'INVALID_INDEXED_DB_KEY'
      | 'INVALID_VERSION_METADATA'
      | 'LOCAL_STORAGE_CHANGED'
      | 'LOCAL_STORAGE_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'V1SourceStorageReadError';
  }
}

function getDefaultIndexedDb(): IDBFactory | undefined {
  return typeof globalThis.indexedDB === 'undefined' ? undefined : globalThis.indexedDB;
}

function getDefaultLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function parseVersionMetadata(
  entries: readonly V1SourceStorageEntry[],
  key: string,
): number | null {
  const entry = entries.find((candidate) => candidate.key === key);
  if (!entry) {
    return null;
  }

  if (typeof entry.value === 'number') {
    if (Number.isInteger(entry.value) && entry.value >= 0) {
      return entry.value;
    }
  } else if (typeof entry.value === 'string') {
    const normalized = entry.value.trim();
    if (/^\d+$/.test(normalized)) {
      const parsed = Number(normalized);
      if (Number.isSafeInteger(parsed)) {
        return parsed;
      }
    }
  }

  throw new V1SourceStorageReadError('INVALID_VERSION_METADATA', `v1 来源的 ${key} 不是非负整数。`);
}

function readLocalStorage(storage: Storage): V1SourceStorageEntry[] {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === null) {
        throw new V1SourceStorageReadError(
          'LOCAL_STORAGE_CHANGED',
          'localStorage 在读取期间发生变化，无法创建一致来源快照。',
        );
      }
      keys.push(key);
    }

    const entries = keys.map((key) => {
      const value = storage.getItem(key);
      if (value === null) {
        throw new V1SourceStorageReadError(
          'LOCAL_STORAGE_CHANGED',
          'localStorage 在读取期间发生变化，无法创建一致来源快照。',
        );
      }
      return { key, value };
    });

    if (storage.length !== keys.length) {
      throw new V1SourceStorageReadError(
        'LOCAL_STORAGE_CHANGED',
        'localStorage 在读取期间发生变化，无法创建一致来源快照。',
      );
    }

    return entries;
  } catch (error) {
    if (error instanceof V1SourceStorageReadError) {
      throw error;
    }
    throw new V1SourceStorageReadError(
      'LOCAL_STORAGE_UNAVAILABLE',
      '当前环境无法只读读取 localStorage，已拒绝创建来源快照。',
    );
  }
}

async function databaseExists(indexedDB: IDBFactory, databaseName: string): Promise<boolean> {
  if (typeof indexedDB.databases !== 'function') {
    throw new V1SourceStorageReadError(
      'INDEXED_DB_ENUMERATION_UNSUPPORTED',
      '当前浏览器无法只读枚举 IndexedDB 数据库，已拒绝创建或猜测来源。',
    );
  }

  try {
    const databases = await indexedDB.databases();
    return databases.some((database) => database.name === databaseName);
  } catch (error) {
    if (error instanceof V1SourceStorageReadError) {
      throw error;
    }
    throw new V1SourceStorageReadError(
      'INDEXED_DB_READ_FAILED',
      '无法只读检查 v1 IndexedDB 数据库。',
    );
  }
}

function openExistingDatabase(indexedDB: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: V1SourceStorageReadError) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(databaseName);
    } catch {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', '无法打开 v1 IndexedDB。'));
      return;
    }

    request.onupgradeneeded = () => {
      // A database created during an adapter read would violate the read-only
      // source boundary. Abort the implicit upgrade instead of accepting it.
      fail(
        new V1SourceStorageReadError(
          'INDEXED_DB_READ_FAILED',
          'v1 IndexedDB 在读取期间需要升级，已拒绝任何写入。',
        ),
      );
      request.transaction?.abort();
    };
    request.onerror = () => {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', '无法打开 v1 IndexedDB。'));
    };
    request.onsuccess = () => {
      if (!settled) {
        settled = true;
        resolve(request.result);
      } else {
        request.result.close();
      }
    };
  });
}

function readObjectStore(
  database: IDBDatabase,
  objectStoreName: string,
): Promise<V1SourceStorageEntry[]> {
  if (!database.objectStoreNames.contains(objectStoreName)) {
    throw new V1SourceStorageReadError(
      'INDEXED_DB_STORE_MISSING',
      `v1 IndexedDB 缺少对象仓库 ${objectStoreName}。`,
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const entries: V1SourceStorageEntry[] = [];
    const fail = (error: V1SourceStorageReadError) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    let transaction: IDBTransaction;
    let request: IDBRequest<IDBCursorWithValue | null>;
    try {
      transaction = database.transaction(objectStoreName, 'readonly');
      request = transaction.objectStore(objectStoreName).openCursor();
    } catch {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', '无法只读读取 v1 IndexedDB。'));
      return;
    }

    request.onerror = () => {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', '无法只读读取 v1 IndexedDB。'));
    };
    transaction.onerror = () => {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', '无法只读读取 v1 IndexedDB。'));
    };
    transaction.onabort = () => {
      fail(new V1SourceStorageReadError('INDEXED_DB_READ_FAILED', 'v1 IndexedDB 读取事务被中止。'));
    };
    request.onsuccess = () => {
      if (settled) {
        return;
      }

      const cursor = request.result;
      if (!cursor) {
        settled = true;
        resolve(entries);
        return;
      }

      if (typeof cursor.key !== 'string' || cursor.key === '') {
        fail(
          new V1SourceStorageReadError(
            'INVALID_INDEXED_DB_KEY',
            'v1 IndexedDB 包含非字符串或空来源键。',
          ),
        );
        transaction.abort();
        return;
      }

      entries.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
  });
}

async function readIndexedDb(
  indexedDB: IDBFactory | undefined,
  databaseName: string,
  objectStoreName: string,
): Promise<V1SourceStorageEntry[]> {
  if (!indexedDB || !(await databaseExists(indexedDB, databaseName))) {
    return [];
  }

  const database = await openExistingDatabase(indexedDB, databaseName);
  try {
    return await readObjectStore(database, objectStoreName);
  } finally {
    database.close();
  }
}

export class BrowserV1SourceStorage implements V1SourceStoragePort {
  readonly #indexedDB: IDBFactory | undefined;
  readonly #localStorage: Storage | undefined;
  readonly #sourceAppVersion: string | null | undefined;
  readonly #databaseName: string;
  readonly #objectStoreName: string;

  constructor(options: BrowserV1SourceStorageOptions = {}) {
    this.#indexedDB = options.indexedDB ?? getDefaultIndexedDb();
    this.#localStorage = options.localStorage ?? getDefaultLocalStorage();
    this.#sourceAppVersion = options.sourceAppVersion;
    this.#databaseName = options.databaseName ?? V1_SOURCE_DATABASE_NAME;
    this.#objectStoreName = options.objectStoreName ?? V1_SOURCE_OBJECT_STORE_NAME;
  }

  async read(): Promise<V1SourceStorageSnapshot> {
    const localStorage = this.#localStorage;
    if (!localStorage) {
      throw new V1SourceStorageReadError(
        'LOCAL_STORAGE_UNAVAILABLE',
        '当前环境无法只读读取 localStorage，已拒绝创建来源快照。',
      );
    }

    const [indexedDb, localStorageEntries] = await Promise.all([
      readIndexedDb(this.#indexedDB, this.#databaseName, this.#objectStoreName),
      Promise.resolve().then(() => readLocalStorage(localStorage)),
    ]);
    const filteredIndexedDb = indexedDb.filter((entry) => entry.key !== V1_STORAGE_PROBE_KEY);

    return {
      indexedDb: filteredIndexedDb,
      localStorage: localStorageEntries,
      sourceAppVersion: this.#sourceAppVersion,
      dataSchemaVersion: parseVersionMetadata(localStorageEntries, 'dataSchemaVersion'),
      wordStorageVersion:
        parseVersionMetadata(localStorageEntries, 'wordStorageVersion') ??
        parseVersionMetadata(filteredIndexedDb, 'wordStorageVersion'),
    };
  }
}
