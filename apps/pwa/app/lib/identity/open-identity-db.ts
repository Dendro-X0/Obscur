import { identityDbName } from "./identity-db-name";
import { identityDbVersion } from "./identity-db-version";
import { identityStoreName } from "./identity-store-name";

type OpenIdentityDbResult = Readonly<{
  db: IDBDatabase;
}>;

const openDb = (): Promise<OpenIdentityDbResult> => {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(identityDbName, identityDbVersion);
    request.onupgradeneeded = () => {
      const db: IDBDatabase = request.result;
      if (!db.objectStoreNames.contains(identityStoreName)) {
        db.createObjectStore(identityStoreName);
      }
    };
    request.onsuccess = () => {
      resolve({ db: request.result });
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"));
    };
  });
};

export const openIdentityDb = async (): Promise<IDBDatabase> => {
  const result: OpenIdentityDbResult = await openDb();
  return result.db;
};
