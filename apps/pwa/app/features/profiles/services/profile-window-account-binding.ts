import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "./profile-scope";

const LAST_BOUND_ACCOUNT_BASE_KEY = "obscur.profile_window.last_bound_account";

const storageKeyForProfile = (profileId: string): string => (
  getScopedStorageKey(LAST_BOUND_ACCOUNT_BASE_KEY, profileId)
);

const lastBoundAccountStorageKeyPrefix = (): string => `${LAST_BOUND_ACCOUNT_BASE_KEY}::`;

export const listProfileIdsWithBoundAccountPublicKeyHex = (
  accountPublicKeyHex: PublicKeyHex,
): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  const normalizedAccount = accountPublicKeyHex.trim().toLowerCase() as PublicKeyHex;
  const prefix = lastBoundAccountStorageKeyPrefix();
  const profileIds: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) {
        continue;
      }
      const boundAccount = window.localStorage.getItem(key)?.trim().toLowerCase();
      if (boundAccount !== normalizedAccount) {
        continue;
      }
      const profileId = key.slice(prefix.length).trim();
      if (profileId.length > 0) {
        profileIds.push(profileId);
      }
    }
  } catch {
    // Best-effort only.
  }
  return profileIds;
};

export const getLastBoundAccountPublicKeyHex = (profileId: string): PublicKeyHex | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKeyForProfile(profileId))?.trim().toLowerCase();
    if (!raw || raw.length !== 64) {
      return null;
    }
    return raw as PublicKeyHex;
  } catch {
    return null;
  }
};

export const setLastBoundAccountPublicKeyHex = (
  profileId: string,
  publicKeyHex: PublicKeyHex,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKeyForProfile(profileId), publicKeyHex.trim().toLowerCase());
  } catch {
    // Best-effort only.
  }
};

export const clearLastBoundAccountPublicKeyHex = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKeyForProfile(profileId));
  } catch {
    // Best-effort only.
  }
};

export type ProfileWindowAccountContinuity = Readonly<{
  status: "initial_bind" | "same_account" | "account_changed";
  previousPublicKeyHex: PublicKeyHex | null;
  nextPublicKeyHex: PublicKeyHex;
}>;

export const evaluateProfileWindowAccountContinuity = (
  profileId: string,
  nextPublicKeyHex: PublicKeyHex,
): ProfileWindowAccountContinuity => {
  const normalizedNext = nextPublicKeyHex.trim().toLowerCase() as PublicKeyHex;
  const previousPublicKeyHex = getLastBoundAccountPublicKeyHex(profileId);
  if (!previousPublicKeyHex) {
    return { status: "initial_bind", previousPublicKeyHex: null, nextPublicKeyHex: normalizedNext };
  }
  if (previousPublicKeyHex === normalizedNext) {
    return { status: "same_account", previousPublicKeyHex, nextPublicKeyHex: normalizedNext };
  }
  return { status: "account_changed", previousPublicKeyHex, nextPublicKeyHex: normalizedNext };
};
