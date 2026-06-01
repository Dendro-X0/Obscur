import type { IdentityRecord } from "@dweb/core/identity-record";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { getIdentityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";
import {
  parseIdentityRecord,
  readIdentityRecordFromLocalStorage,
  writeIdentityRecordToLocalStorage,
} from "./identity-persistence";

type GetStoredIdentityResult = Readonly<{
  record?: IdentityRecord;
}>;

const readIdentityRecordFromMemoryDb = async (identityDbKey: string): Promise<IdentityRecord | undefined> => {
  const db: IDBDatabase = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readonly");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const request: IDBRequest = store.get(identityDbKey);
    request.onsuccess = () => {
      resolve(parseIdentityRecord(request.result));
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read identity"));
    };
  });
};

export const getStoredIdentity = async (): Promise<GetStoredIdentityResult> => {
  const profileId = readActiveDesktopProfileId();
  const identityDbKey = getIdentityDbKey();

  const durableRecord = readIdentityRecordFromLocalStorage(profileId);
  if (durableRecord) {
    return { record: durableRecord };
  }

  const sessionRecord = await readIdentityRecordFromMemoryDb(identityDbKey);
  if (sessionRecord) {
    writeIdentityRecordToLocalStorage({ profileId, record: sessionRecord });
    return { record: sessionRecord };
  }

  return { record: undefined };
};
