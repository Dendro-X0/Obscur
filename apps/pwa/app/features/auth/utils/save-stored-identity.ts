import type { IdentityRecord } from "@dweb/core/identity-record";
import { getIdentityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";
import {
  profileIdFromIdentityStorageKey,
  removeIdentityRecordsForPublicKey,
  writeIdentityRecordToLocalStorage,
} from "./identity-persistence";

type SaveStoredIdentityParams = Readonly<{
  record: IdentityRecord;
}>;

const persistIdentityRecordToMemoryDb = async (params: Readonly<{
  identityDbKey: string;
  record: IdentityRecord;
}>): Promise<void> => {
  const db: IDBDatabase = await openIdentityDb();
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
          && key !== params.identityDbKey
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

      const request: IDBRequest<IDBValidKey> = store.put(params.record, params.identityDbKey);
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

export const saveStoredIdentity = async (params: SaveStoredIdentityParams): Promise<void> => {
  const identityDbKey = getIdentityDbKey();
  const profileId = profileIdFromIdentityStorageKey(identityDbKey);

  removeIdentityRecordsForPublicKey({
    publicKeyHex: params.record.publicKeyHex,
    keepProfileId: profileId,
  });
  writeIdentityRecordToLocalStorage({ profileId, record: params.record });
  await persistIdentityRecordToMemoryDb({ identityDbKey, record: params.record });
};
