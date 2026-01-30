import type { IdentityRecord } from "@dweb/core/identity-record";
import { identityDbKey } from "./identity-db-key";
import { identityStoreName } from "./identity-store-name";
import { openIdentityDb } from "./open-identity-db";

type GetStoredIdentityResult = Readonly<{
  record?: IdentityRecord;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseIdentityRecord = (value: unknown): IdentityRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const encryptedPrivateKey: unknown = value.encryptedPrivateKey;
  const publicKeyHex: unknown = value.publicKeyHex;
  if (typeof encryptedPrivateKey !== "string" || typeof publicKeyHex !== "string") {
    return undefined;
  }
  return { encryptedPrivateKey, publicKeyHex };
};

export const getStoredIdentity = async (): Promise<GetStoredIdentityResult> => {
  const db: IDBDatabase = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx: IDBTransaction = db.transaction(identityStoreName, "readonly");
    const store: IDBObjectStore = tx.objectStore(identityStoreName);
    const request: IDBRequest = store.get(identityDbKey);
    request.onsuccess = () => {
      resolve({ record: parseIdentityRecord(request.result) });
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read identity"));
    };
  });
};
