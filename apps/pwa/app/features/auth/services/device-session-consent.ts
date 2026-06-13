import {
  getRememberMeScopedStorageKeys,
} from "@/app/features/auth/utils/auth-storage-keys";
import { isNativeDeviceSessionConsentPersistenceEnabled } from "@/app/features/auth/services/session-credential-policy";

/**
 * Per-profile "stay signed in on this device" consent (trust flag only on native desktop).
 * Absent keys default to true so cold-start restore matches Chrome-like expectations.
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
  if (!isNativeDeviceSessionConsentPersistenceEnabled()) {
    return true;
  }
  return readDeviceSessionConsent(profileId);
};

export type SessionUnlockOptions = Readonly<{
  staySignedIn?: boolean;
}>;

export const resolveStaySignedIn = (options?: SessionUnlockOptions): boolean => (
  options?.staySignedIn !== false
);
