import type { IdentityRecord } from "@dweb/core/identity-record";
import { identityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";

type SaveStoredIdentityParams = Readonly<{
  record: IdentityRecord;
}>;

export const saveStoredIdentity = async (params: SaveStoredIdentityParams): Promise<void> => {
  const db: IDBDatabase = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readwrite");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const request: IDBRequest<IDBValidKey> = store.put(params.record, identityDbKey);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to persist identity"));
    };
  });
};
