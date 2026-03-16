import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { openIdentityDb } from "./open-identity-db";
import { identityStoreName } from "./identity-store-name";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { getActiveProfileIdSafe, getProfileIdentityDbKey, getProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";

export type IdentityProfileBinding = Readonly<{
  profileId: string;
  record: IdentityRecord;
}>;

const LEGACY_IDENTITY_DB_KEY = "primary";

const parseIdentityRecord = (value: unknown): IdentityRecord | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.encryptedPrivateKey !== "string" || typeof candidate.publicKeyHex !== "string") {
    return null;
  }
  return {
    encryptedPrivateKey: candidate.encryptedPrivateKey,
    publicKeyHex: candidate.publicKeyHex,
    username: typeof candidate.username === "string" ? candidate.username : undefined,
  };
};

const profileIdFromIdentityDbKey = (dbKey: string): string => {
  if (dbKey === LEGACY_IDENTITY_DB_KEY) {
    return "default";
  }
  if (dbKey.startsWith("identity::")) {
    return dbKey.slice("identity::".length);
  }
  return dbKey;
};

export const canonicalProfileIdForPublicKey = (publicKeyHex: PublicKeyHex): string => {
  return `pk-${publicKeyHex}`;
};

const defaultProfileLabelForPublicKey = (publicKeyHex: PublicKeyHex, username?: string): string => {
  return username?.trim() || `Account ${publicKeyHex.slice(0, 8)}`;
};

export const listStoredIdentityBindings = async (): Promise<ReadonlyArray<IdentityProfileBinding>> => {
  const db = await openIdentityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(identityStoreName, "readonly");
    const store = tx.objectStore(identityStoreName);
    const bindings: IdentityProfileBinding[] = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(bindings);
        return;
      }
      const record = parseIdentityRecord(cursor.value);
      if (record && typeof cursor.key === "string") {
        bindings.push({
          profileId: profileIdFromIdentityDbKey(cursor.key),
          record,
        });
      }
      cursor.continue();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to enumerate stored identities"));
    };
  });
};

export const findStoredIdentityBindingByPublicKey = async (
  publicKeyHex: PublicKeyHex
): Promise<IdentityProfileBinding | null> => {
  const bindings = await listStoredIdentityBindings();
  return bindings.find((binding) => binding.record.publicKeyHex === publicKeyHex) ?? null;
};

const migrateScopedStorage = (sourceProfileId: string, targetProfileId: string): void => {
  if (typeof window === "undefined" || sourceProfileId === targetProfileId) {
    return;
  }
  const sourceSuffix = `::${sourceProfileId}`;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.endsWith(sourceSuffix)) {
      continue;
    }
    const targetKey = key.slice(0, key.length - sourceSuffix.length) + `::${targetProfileId}`;
    if (window.localStorage.getItem(targetKey) === null) {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        window.localStorage.setItem(targetKey, value);
      }
    }
  }
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key || !key.endsWith(sourceSuffix)) {
      continue;
    }
    const targetKey = key.slice(0, key.length - sourceSuffix.length) + `::${targetProfileId}`;
    if (window.sessionStorage.getItem(targetKey) === null) {
      const value = window.sessionStorage.getItem(key);
      if (value !== null) {
        window.sessionStorage.setItem(targetKey, value);
      }
    }
  }
};

export const ensureIdentityProfileBinding = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  username?: string;
}>): Promise<string> => {
  const existing = await findStoredIdentityBindingByPublicKey(params.publicKeyHex);
  const explicitProfileScope = getProfileScopeOverride();
  const currentActiveProfileId = getActiveProfileIdSafe();
  const targetProfileId = explicitProfileScope?.trim() || existing?.profileId || canonicalProfileIdForPublicKey(params.publicKeyHex);
  const label = existing?.record.username || defaultProfileLabelForPublicKey(params.publicKeyHex, params.username);

  const ensured = ProfileRegistryService.ensureProfile(targetProfileId, label);
  if (!ensured.ok) {
    throw new Error(ensured.message || "Failed to ensure identity profile");
  }

  if (!existing && !explicitProfileScope && currentActiveProfileId !== targetProfileId) {
    migrateScopedStorage(currentActiveProfileId, targetProfileId);
  }

  if (explicitProfileScope) {
    return targetProfileId;
  }

  const switched = ProfileRegistryService.switchProfile(targetProfileId);
  if (!switched.ok) {
    throw new Error(switched.message || "Failed to switch identity profile");
  }

  return targetProfileId;
};

export const recoverSingleStoredIdentityProfile = async (): Promise<IdentityProfileBinding | null> => {
  const bindings = await listStoredIdentityBindings();
  if (bindings.length !== 1) {
    return null;
  }
  const binding = bindings[0]!;
  const ensure = ProfileRegistryService.ensureProfile(
    binding.profileId,
    defaultProfileLabelForPublicKey(binding.record.publicKeyHex as PublicKeyHex, binding.record.username)
  );
  if (!ensure.ok) {
    throw new Error(ensure.message || "Failed to ensure recovered identity profile");
  }
  const switched = ProfileRegistryService.switchProfile(binding.profileId);
  if (!switched.ok) {
    throw new Error(switched.message || "Failed to switch recovered identity profile");
  }
  return binding;
};

export const identityProfileBindingInternals = {
  profileIdFromIdentityDbKey,
  migrateScopedStorage,
  defaultProfileLabelForPublicKey,
  getProfileIdentityDbKey,
};
