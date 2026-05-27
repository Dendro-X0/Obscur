import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getProfileIdentityDbKey, getDefaultProfileIdentityDbKey } from "@/app/features/profiles/services/profile-scope";

export const IDENTITY_RECORD_STORAGE_BASE_KEY = "obscur.identity.record";
const LEGACY_IDENTITY_DB_KEY = "primary";

export const profileIdFromIdentityStorageKey = (storageKey: string): string => {
  if (storageKey === `${IDENTITY_RECORD_STORAGE_BASE_KEY}::${LEGACY_IDENTITY_DB_KEY}`) {
    return "default";
  }
  if (storageKey.startsWith(`${IDENTITY_RECORD_STORAGE_BASE_KEY}::`)) {
    return storageKey.slice(`${IDENTITY_RECORD_STORAGE_BASE_KEY}::`.length);
  }
  if (storageKey === `identity::${LEGACY_IDENTITY_DB_KEY}`) {
    return "default";
  }
  if (storageKey.startsWith("identity::")) {
    return storageKey.slice("identity::".length);
  }
  return storageKey;
};

export const getIdentityRecordStorageKey = (profileId: string): string => (
  `${IDENTITY_RECORD_STORAGE_BASE_KEY}::${profileId}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const parseIdentityRecord = (value: unknown): IdentityRecord | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const encryptedPrivateKey = value.encryptedPrivateKey;
  const publicKeyHex = value.publicKeyHex;
  const username = value.username;
  if (typeof encryptedPrivateKey !== "string" || typeof publicKeyHex !== "string") {
    return undefined;
  }
  return {
    encryptedPrivateKey,
    publicKeyHex: publicKeyHex as PublicKeyHex,
    username: typeof username === "string" ? username : undefined,
  };
};

export const readIdentityRecordFromLocalStorage = (profileId: string): IdentityRecord | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const keys = [
    getIdentityRecordStorageKey(profileId),
    getProfileIdentityDbKey(profileId),
    profileId === "default" ? getDefaultProfileIdentityDbKey() : null,
    profileId === "default" ? getIdentityRecordStorageKey(LEGACY_IDENTITY_DB_KEY) : null,
  ].filter((key): key is string => Boolean(key));

  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      continue;
    }
    try {
      const parsed = parseIdentityRecord(JSON.parse(raw));
      if (parsed) {
        return parsed;
      }
    } catch {
      // Ignore corrupt payloads and continue scanning aliases.
    }
  }
  return undefined;
};

export const writeIdentityRecordToLocalStorage = (params: Readonly<{
  profileId: string;
  record: IdentityRecord;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const payload = JSON.stringify(params.record);
  window.localStorage.setItem(getIdentityRecordStorageKey(params.profileId), payload);
  window.localStorage.setItem(getProfileIdentityDbKey(params.profileId), payload);
};

export const removeIdentityRecordsForPublicKey = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  keepProfileId: string;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const isIdentityKey = key.startsWith(`${IDENTITY_RECORD_STORAGE_BASE_KEY}::`)
      || key.startsWith("identity::");
    if (!isIdentityKey) {
      continue;
    }
    const profileId = profileIdFromIdentityStorageKey(key);
    if (profileId === params.keepProfileId) {
      continue;
    }
    const record = readIdentityRecordFromLocalStorage(profileId);
    if (record?.publicKeyHex === params.publicKeyHex) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

export const listIdentityRecordsFromLocalStorage = (): ReadonlyArray<Readonly<{
  profileId: string;
  record: IdentityRecord;
}>> => {
  if (typeof window === "undefined") {
    return [];
  }
  const bindings = new Map<string, IdentityRecord>();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const isIdentityKey = key.startsWith(`${IDENTITY_RECORD_STORAGE_BASE_KEY}::`)
      || key.startsWith("identity::");
    if (!isIdentityKey) {
      continue;
    }
    const profileId = profileIdFromIdentityStorageKey(key);
    if (bindings.has(profileId)) {
      continue;
    }
    const record = readIdentityRecordFromLocalStorage(profileId);
    if (record) {
      bindings.set(profileId, record);
    }
  }
  return Array.from(bindings.entries()).map(([profileId, record]) => ({ profileId, record }));
};

export const clearIdentityRecordsFromLocalStorage = (params?: Readonly<{
  profileId?: string;
  publicKeyHex?: PublicKeyHex;
}>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const isIdentityKey = key.startsWith(`${IDENTITY_RECORD_STORAGE_BASE_KEY}::`)
      || key.startsWith("identity::");
    if (!isIdentityKey) {
      continue;
    }
    if (!params?.profileId && !params?.publicKeyHex) {
      keysToRemove.push(key);
      continue;
    }
    const profileId = profileIdFromIdentityStorageKey(key);
    if (params.profileId && profileId === params.profileId) {
      keysToRemove.push(key);
      continue;
    }
    if (params.publicKeyHex) {
      const record = readIdentityRecordFromLocalStorage(profileId);
      if (record?.publicKeyHex === params.publicKeyHex) {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
};
