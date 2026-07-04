import {
  getRememberMeScopedStorageKeys,
} from "@/app/features/auth/utils/auth-storage-keys";
import {
  isNativeDeviceSessionConsentPersistenceEnabled,
  NATIVE_SECURE_SESSION_RESTORE_ENABLED,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";

/**
 * Per-profile "stay signed in on this device" consent (mobile shell / mobile native only).
 * Absent keys default to true when consent persistence is enabled.
 */
export const readDeviceSessionConsent = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return true;
  }
  const keys = getRememberMeScopedStorageKeys({
    profileId,
    includeLegacy: true,
  });
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value === "false") {
      return false;
    }
    if (value === "true") {
      return true;
    }
  }
  return true;
};

export const isDeviceSessionRestoreAllowed = (profileId: string): boolean => {
  if (!NATIVE_SECURE_SESSION_RESTORE_ENABLED) {
    return false;
  }
  if (!isNativeDeviceSessionConsentPersistenceEnabled()) {
    return true;
  }
  return readDeviceSessionConsent(profileId);
};

export type SessionUnlockOptions = Readonly<{
  staySignedIn?: boolean;
}>;

export const resolveStaySignedIn = (options?: SessionUnlockOptions): boolean => {
  const persistenceEnabled = isNativeDeviceSessionConsentPersistenceEnabled()
    || SESSION_CREDENTIAL_PERSISTENCE_ENABLED;
  if (!persistenceEnabled) {
    return false;
  }
  return options?.staySignedIn !== false;
};
