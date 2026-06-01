import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { openIdentityDb } from "./open-identity-db";
import { identityStoreName } from "./identity-store-name";
import {
  listIdentityRecordsFromLocalStorage,
  parseIdentityRecord as parseIdentityRecordFromPersistence,
} from "./identity-persistence";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { getProfileIdentityDbKey, getProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type IdentityProfileBinding = Readonly<{
  profileId: string;
  record: IdentityRecord;
}>;

const LEGACY_IDENTITY_DB_KEY = "primary";
const REMEMBER_ME_BASE_KEY = "obscur_remember_me";
const AUTH_TOKEN_BASE_KEY = "obscur_auth_token";
const SCOPED_STORAGE_DELIMITER = "::";

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

const unique = (values: ReadonlyArray<string>): ReadonlyArray<string> => Array.from(new Set(values));

const extractProfileIdFromScopedStorageKey = (storageKey: string): string | null => {
  const separatorIndex = storageKey.lastIndexOf(SCOPED_STORAGE_DELIMITER);
  if (separatorIndex < 0) {
    return null;
  }
  const profileId = storageKey.slice(separatorIndex + SCOPED_STORAGE_DELIMITER.length).trim();
  if (profileId.length === 0) {
    return null;
  }
  return profileId;
};

const collectScopedAccountProfileCandidates = (publicKeyHex: PublicKeyHex): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  const normalizedPublicKeyHex = publicKeyHex.trim().toLowerCase();
  if (normalizedPublicKeyHex.length === 0) {
    return [];
  }

  const profileIds: string[] = [];
  const collectFromStorage = (storage: Storage): void => {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.toLowerCase().includes(normalizedPublicKeyHex)) {
        continue;
      }
      const profileId = extractProfileIdFromScopedStorageKey(key);
      if (profileId) {
        profileIds.push(profileId);
      }
    }
  };

  try {
    collectFromStorage(window.localStorage);
  } catch {
    // Continue with best-effort profile candidate discovery.
  }
  try {
    collectFromStorage(window.sessionStorage);
  } catch {
    // Continue with best-effort profile candidate discovery.
  }

  return unique(profileIds);
};

const collectRememberedProfileCandidates = (): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  const profileIds: string[] = [];
  const pushProfileId = (profileId: string | null | undefined): void => {
    const normalized = profileId?.trim();
    if (!normalized) {
      return;
    }
    profileIds.push(normalized);
  };

  const rememberPrefix = `${REMEMBER_ME_BASE_KEY}::`;
  const tokenPrefix = `${AUTH_TOKEN_BASE_KEY}::`;
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    const value = window.localStorage.getItem(key);
    if (key === REMEMBER_ME_BASE_KEY && value === "true") {
      pushProfileId("default");
      continue;
    }
    if (key.startsWith(rememberPrefix) && value === "true") {
      pushProfileId(key.slice(rememberPrefix.length));
      continue;
    }
    if (key === AUTH_TOKEN_BASE_KEY && typeof value === "string" && value.length > 0) {
      pushProfileId("default");
      continue;
    }
    if (key.startsWith(tokenPrefix) && typeof value === "string" && value.length > 0) {
      pushProfileId(key.slice(tokenPrefix.length));
    }
  }

  return unique(profileIds);
};

const selectPreferredStoredIdentityBinding = (
  bindings: ReadonlyArray<IdentityProfileBinding>,
): IdentityProfileBinding | null => {
  if (bindings.length === 0) {
    return null;
  }
  const byProfileId = new Map(bindings.map((binding) => [binding.profileId, binding]));
  const candidates: string[] = [];
  const pushCandidate = (profileId: string | null | undefined): void => {
    const normalized = profileId?.trim();
    if (!normalized) {
      return;
    }
    candidates.push(normalized);
  };

  pushCandidate(getProfileScopeOverride());
  pushCandidate(getResolvedProfileId());
  collectRememberedProfileCandidates().forEach((profileId) => {
    pushCandidate(profileId);
  });

  try {
    const registryState = ProfileRegistryService.getState();
    pushCandidate(registryState.activeProfileId);
    [...registryState.profiles]
      .sort((left, right) => right.lastUsedAtUnixMs - left.lastUsedAtUnixMs)
      .forEach((profile) => pushCandidate(profile.profileId));
  } catch {
    // Ignore registry lookup failures; fallback heuristics below remain deterministic.
  }

  const uniqueCandidates = unique(candidates);
  for (const candidate of uniqueCandidates) {
    const matched = byProfileId.get(candidate);
    if (matched) {
      return matched;
    }
  }

  return bindings.length === 1 ? bindings[0]! : null;
};

export const canonicalProfileIdForPublicKey = (publicKeyHex: PublicKeyHex): string => {
  return `pk-${publicKeyHex}`;
};

const defaultProfileLabelForPublicKey = (publicKeyHex: PublicKeyHex, username?: string): string => {
  return username?.trim() || `Account ${publicKeyHex.slice(0, 8)}`;
};

export const listStoredIdentityBindings = async (): Promise<ReadonlyArray<IdentityProfileBinding>> => {
  const merged = new Map<string, IdentityRecord>();
  listIdentityRecordsFromLocalStorage().forEach(({ profileId, record }) => {
    merged.set(profileId, record);
  });

  const db = await openIdentityDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(identityStoreName, "readonly");
    const store = tx.objectStore(identityStoreName);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const record = parseIdentityRecordFromPersistence(cursor.value) ?? parseIdentityRecord(cursor.value);
      if (record && typeof cursor.key === "string") {
        const profileId = profileIdFromIdentityDbKey(cursor.key);
        if (!merged.has(profileId)) {
          merged.set(profileId, record);
        }
      }
      cursor.continue();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Failed to enumerate stored identities"));
    };
  });

  return Array.from(merged.entries()).map(([profileId, record]) => ({ profileId, record }));
};

export const findStoredIdentityBindingByPublicKey = async (
  publicKeyHex: PublicKeyHex
): Promise<IdentityProfileBinding | null> => {
  const bindings = await listStoredIdentityBindings();
  return bindings.find((binding) => binding.record.publicKeyHex === publicKeyHex) ?? null;
};

const migrateScopedStorageForAccount = (
  publicKeyHex: PublicKeyHex,
  sourceProfileId: string,
  targetProfileId: string,
): void => {
  if (typeof window === "undefined" || sourceProfileId === targetProfileId) {
    return;
  }
  const normalizedPublicKeyHex = publicKeyHex.trim().toLowerCase();
  const sourceSuffix = `${SCOPED_STORAGE_DELIMITER}${sourceProfileId}`;
  const targetSuffix = `${SCOPED_STORAGE_DELIMITER}${targetProfileId}`;
  const isProfileOnlyScopedKey = (key: string): boolean => (
    key === REMEMBER_ME_BASE_KEY
    || key.startsWith(`${REMEMBER_ME_BASE_KEY}${SCOPED_STORAGE_DELIMITER}`)
    || key === AUTH_TOKEN_BASE_KEY
    || key.startsWith(`${AUTH_TOKEN_BASE_KEY}${SCOPED_STORAGE_DELIMITER}`)
    || key.startsWith("dweb.nostr.pwa.profile")
  );
  const shouldMigrateKey = (key: string): boolean => (
    key.endsWith(sourceSuffix)
    && (
      key.toLowerCase().includes(normalizedPublicKeyHex)
      || isProfileOnlyScopedKey(key)
    )
  );
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !shouldMigrateKey(key)) {
      continue;
    }
    const targetKey = key.slice(0, key.length - sourceSuffix.length) + targetSuffix;
    if (window.localStorage.getItem(targetKey) === null) {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        window.localStorage.setItem(targetKey, value);
      }
    }
  }
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key || !shouldMigrateKey(key)) {
      continue;
    }
    const targetKey = key.slice(0, key.length - sourceSuffix.length) + targetSuffix;
    if (window.sessionStorage.getItem(targetKey) === null) {
      const value = window.sessionStorage.getItem(key);
      if (value !== null) {
        window.sessionStorage.setItem(targetKey, value);
      }
    }
  }
};

const collectScopedStorageMigrationSources = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  targetProfileId: string;
  existingProfileId?: string;
  currentActiveProfileId: string;
  explicitProfileScope?: string | null;
}>): ReadonlyArray<string> => {
  const sourceProfileIds: string[] = [];
  const pushProfileId = (profileId: string | null | undefined): void => {
    const normalized = profileId?.trim();
    if (!normalized || normalized === params.targetProfileId) {
      return;
    }
    sourceProfileIds.push(normalized);
  };

  pushProfileId(params.existingProfileId);

  collectScopedAccountProfileCandidates(params.publicKeyHex).forEach((profileId) => {
    pushProfileId(profileId);
  });

  return unique(sourceProfileIds);
};

export const ensureIdentityProfileBinding = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  username?: string;
}>): Promise<string> => {
  const existing = await findStoredIdentityBindingByPublicKey(params.publicKeyHex);
  const explicitProfileScope = getProfileScopeOverride();
  const currentActiveProfileId = getResolvedProfileId();
  const targetProfileId = explicitProfileScope?.trim() || existing?.profileId || canonicalProfileIdForPublicKey(params.publicKeyHex);
  const label = existing?.record.username || defaultProfileLabelForPublicKey(params.publicKeyHex, params.username);

  const ensured = ProfileRegistryService.ensureProfile(targetProfileId, label);
  if (!ensured.ok) {
    throw new Error(ensured.message || "Failed to ensure identity profile");
  }

  // Desktop/mobile profile windows own their slot locally (Chrome-profile model).
  // Never pull another slot's scoped storage into this window on login.
  if (!explicitProfileScope) {
    const migrationSources = collectScopedStorageMigrationSources({
      publicKeyHex: params.publicKeyHex,
      targetProfileId,
      existingProfileId: existing?.profileId,
      currentActiveProfileId,
      explicitProfileScope,
    });
    migrationSources.forEach((sourceProfileId) => {
      migrateScopedStorageForAccount(params.publicKeyHex, sourceProfileId, targetProfileId);
    });
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

export const recoverStoredIdentityProfile = async (): Promise<IdentityProfileBinding | null> => {
  const bindings = await listStoredIdentityBindings();
  const binding = selectPreferredStoredIdentityBinding(bindings);
  if (!binding) {
    return null;
  }
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
  extractProfileIdFromScopedStorageKey,
  collectScopedAccountProfileCandidates,
  migrateScopedStorageForAccount,
  collectScopedStorageMigrationSources,
  defaultProfileLabelForPublicKey,
  getProfileIdentityDbKey,
  collectRememberedProfileCandidates,
  selectPreferredStoredIdentityBinding,
};
