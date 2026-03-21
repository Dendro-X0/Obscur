import { identityDbName } from "./identity-db-name";
import { identityDbVersion } from "./identity-db-version";
import { identityStoreName } from "./identity-store-name";

type OpenIdentityDbResult = Readonly<{
  db: IDBDatabase;
}>;

const IDENTITY_DB_OPEN_TIMEOUT_MS = 8_000;

const openDb = (): Promise<OpenIdentityDbResult> => {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finalize = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeoutId);
      callback();
    };

    const request: IDBOpenDBRequest = indexedDB.open(identityDbName, identityDbVersion);
    const timeoutId = globalThis.setTimeout(() => {
      finalize(() => {
        reject(new Error(`Timed out opening identity database after ${IDENTITY_DB_OPEN_TIMEOUT_MS}ms.`));
      });
    }, IDENTITY_DB_OPEN_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      const db: IDBDatabase = request.result;
      if (!db.objectStoreNames.contains(identityStoreName)) {
        db.createObjectStore(identityStoreName);
      }
    };

    request.onblocked = () => {
      finalize(() => {
        reject(new Error("Identity database open blocked by another active connection."));
      });
    };

    request.onsuccess = () => {
      finalize(() => {
        resolve({ db: request.result });
      });
    };
    request.onerror = () => {
      finalize(() => {
        reject(request.error ?? new Error("Failed to open IndexedDB"));
      });
    };
  });
};

export const openIdentityDb = async (): Promise<IDBDatabase> => {
  const result: OpenIdentityDbResult = await openDb();
  return result.db;
};

export const openIdentityDbInternals = {
  IDENTITY_DB_OPEN_TIMEOUT_MS,
} as const;
