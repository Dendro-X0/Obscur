import { getIdentityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";

export const clearStoredIdentity = async (): Promise<void> => {
  const db: IDBDatabase = await openIdentityDb();
  const identityDbKey = getIdentityDbKey();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readwrite");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const readCurrentRequest: IDBRequest = store.get(identityDbKey);
    readCurrentRequest.onsuccess = () => {
      const current = readCurrentRequest.result as { publicKeyHex?: unknown } | undefined;
      const publicKeyHex = typeof current?.publicKeyHex === "string" ? current.publicKeyHex : null;
      const keysToDelete = new Set<string>([identityDbKey]);
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const key = typeof cursor.key === "string" ? cursor.key : null;
          const value = cursor.value as { publicKeyHex?: unknown } | undefined;
          if (
            key
            && publicKeyHex
            && typeof value?.publicKeyHex === "string"
            && value.publicKeyHex === publicKeyHex
          ) {
            keysToDelete.add(key);
          }
          cursor.continue();
          return;
        }

        keysToDelete.forEach((key) => {
          store.delete(key);
        });
        resolve();
      };
      cursorRequest.onerror = () => {
        reject(cursorRequest.error ?? new Error("Failed to scan identities during clear"));
      };
    };
    readCurrentRequest.onerror = () => {
      reject(readCurrentRequest.error ?? new Error("Failed to load identity for clear"));
    };
  });
};
