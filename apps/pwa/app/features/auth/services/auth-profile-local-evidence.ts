import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import { getThemeStorageKey } from "@/app/features/settings/services/ui-preferences-persistence";
import { getLastBoundAccountPublicKeyHex } from "@/app/features/profiles/services/profile-window-account-binding";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";

/** Bump when auth/DM surface behavior changes — visible on login so rebuilds are provable. */
export const AUTH_CLIENT_REVISION = CLIENT_BUILD_STAMP;

const CHAT_STATE_KEY_FRAGMENT = "dweb.nostr.pwa.chatState";
const IDENTITY_KEY_FRAGMENT = "obscur.identity.record";
const PROFILE_WINDOW_SESSION_KEY_BASE = "obscur.profile_window.session.v1";

export const profileWindowSessionStorageKey = (profileId: string): string => (
  getScopedStorageKey(PROFILE_WINDOW_SESSION_KEY_BASE, profileId)
);

export const markProfileWindowSessionEstablished = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  const normalizedProfileId = profileId.trim() || "default";
  try {
    window.localStorage.setItem(
      profileWindowSessionStorageKey(normalizedProfileId),
      String(Date.now()),
    );
  } catch {
    // best-effort
  }
};

export const profileWindowHasEstablishedSession = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return Boolean(window.localStorage.getItem(profileWindowSessionStorageKey(profileId))?.trim());
  } catch {
    return false;
  }
};

const localStorageKeyMatchesProfile = (key: string, profileId: string): boolean => (
  key.includes(`::${profileId}`)
  || key.endsWith(`.${profileId}`)
  || (profileId === "default" && !key.includes("::"))
);

/**
 * True when this profile window has ever held account data locally, even if
 * startup auth state has not hydrated `storedPublicKeyHex` yet.
 */
export const profileWindowHasLocalAccountEvidence = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedProfileId = profileId.trim() || "default";

  if (readIdentityRecordFromLocalStorage(normalizedProfileId)) {
    return true;
  }

  if (getLastBoundAccountPublicKeyHex(normalizedProfileId)) {
    return true;
  }

  if (profileWindowHasEstablishedSession(normalizedProfileId)) {
    return true;
  }

  try {
    if (window.localStorage.getItem(getThemeStorageKey(normalizedProfileId))?.trim()) {
      return true;
    }
  } catch {
    // ignore
  }

  const boundAccountKey = getScopedStorageKey("obscur.profile_window.last_bound_account", normalizedProfileId);
  try {
    if (window.localStorage.getItem(boundAccountKey)?.trim()) {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) {
        continue;
      }
      if (!localStorageKeyMatchesProfile(key, normalizedProfileId)) {
        continue;
      }
      if (key.includes(CHAT_STATE_KEY_FRAGMENT) || key.includes(IDENTITY_KEY_FRAGMENT)) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
};
