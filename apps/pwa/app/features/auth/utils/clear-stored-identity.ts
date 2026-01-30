import { identityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";

export const clearStoredIdentity = async (): Promise<void> => {
  const db: IDBDatabase = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readwrite");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const request: IDBRequest = store.delete(identityDbKey);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to clear identity"));
    };
  });
};
