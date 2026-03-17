import type { IdentityRecord } from "@dweb/core/identity-record";
import { getIdentityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";

type SaveStoredIdentityParams = Readonly<{
  record: IdentityRecord;
}>;

export const saveStoredIdentity = async (params: SaveStoredIdentityParams): Promise<void> => {
  const db: IDBDatabase = await openIdentityDb();
  const identityDbKey = getIdentityDbKey();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readwrite");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const duplicateKeysToDelete: string[] = [];
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (cursor) {
        const key = typeof cursor.key === "string" ? cursor.key : null;
        const value = cursor.value as Partial<IdentityRecord> | undefined;
        if (
          key
          && key !== identityDbKey
          && typeof value?.publicKeyHex === "string"
          && value.publicKeyHex === params.record.publicKeyHex
        ) {
          duplicateKeysToDelete.push(key);
        }
        cursor.continue();
        return;
      }

      duplicateKeysToDelete.forEach((key) => {
        store.delete(key);
      });

      const request: IDBRequest<IDBValidKey> = store.put(params.record, identityDbKey);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to persist identity"));
      };
    };
    cursorRequest.onerror = () => {
      reject(cursorRequest.error ?? new Error("Failed to scan existing identities"));
    };
  });
};
