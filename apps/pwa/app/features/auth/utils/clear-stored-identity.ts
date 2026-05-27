import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getIdentityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";
import {
  clearIdentityRecordsFromLocalStorage,
  profileIdFromIdentityStorageKey,
  readIdentityRecordFromLocalStorage,
} from "./identity-persistence";

export const clearStoredIdentity = async (): Promise<void> => {
  const identityDbKey = getIdentityDbKey();
  const profileId = profileIdFromIdentityStorageKey(identityDbKey);
  const durableRecord = readIdentityRecordFromLocalStorage(profileId);
  const publicKeyHex = durableRecord?.publicKeyHex as PublicKeyHex | undefined;

  clearIdentityRecordsFromLocalStorage({
    profileId,
    publicKeyHex,
  });

  const db: IDBDatabase = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readwrite");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const readCurrentRequest: IDBRequest = store.get(identityDbKey);
    readCurrentRequest.onsuccess = () => {
      const current = readCurrentRequest.result as { publicKeyHex?: unknown } | undefined;
      const memoryPublicKeyHex = typeof current?.publicKeyHex === "string" ? current.publicKeyHex : null;
      const keysToDelete = new Set<string>([identityDbKey]);
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          const key = typeof cursor.key === "string" ? cursor.key : null;
          const value = cursor.value as { publicKeyHex?: unknown } | undefined;
          const targetPublicKeyHex = publicKeyHex ?? memoryPublicKeyHex;
          if (
            key
            && targetPublicKeyHex
            && typeof value?.publicKeyHex === "string"
            && value.publicKeyHex === targetPublicKeyHex
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
