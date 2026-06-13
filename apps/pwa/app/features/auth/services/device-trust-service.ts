import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  getAuthTokenScopedStorageKeys,
  getRememberMeScopedStorageKeys,
  getRememberMeStorageKey,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_REMEMBER_ME_KEY,
} from "@/app/features/auth/utils/auth-storage-keys";
import {
  isDeviceSessionTrustPersistenceEnabled,
  isNativeDeviceSessionConsentPersistenceEnabled,
  SESSION_CREDENTIAL_PERSISTENCE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";
import { readDeviceSessionConsent } from "@/app/features/auth/services/device-session-consent";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { logAppEvent } from "@/app/shared/log-app-event";

export type DeviceTrustRestorePath = "native_session" | "device_unlock_token" | "none";

export type DeviceTrustSnapshot = Readonly<{
  profileId: string;
  trusted: boolean;
  restorePath: DeviceTrustRestorePath;
  hasUnlockToken: boolean;
  usesNativeSecureStore: boolean;
}>;

const readRememberEnabled = (profileId: string): boolean => readDeviceSessionConsent(profileId);

const readUnlockTokenCount = (profileId: string): number => {
  if (typeof window === "undefined") {
    return 0;
  }
  const values = getAuthTokenScopedStorageKeys({
    profileId,
    includeLegacy: true,
  }).flatMap((key) => {
    const value = window.localStorage.getItem(key);
    return value && value.length > 0 ? [value] : [];
  });
  return new Set(values).size;
};

const clearUnlockTokens = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  getAuthTokenScopedStorageKeys({
    profileId,
    includeLegacy: true,
  }).forEach((key) => {
    removeFromStorages(key);
  });
};

const removeFromStorages = (key: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(key);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // best-effort for constrained runtimes
  }
};

const writeTrustFlag = (profileId: string, trusted: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }
  const rememberKeys = getRememberMeScopedStorageKeys({
    profileId,
    includeLegacy: true,
  });
  const canonicalKey = getRememberMeStorageKey(profileId);
  rememberKeys.forEach((key) => {
    if (trusted) {
      window.localStorage.setItem(key, "true");
      return;
    }
    if (key === canonicalKey) {
      window.localStorage.setItem(key, "false");
      return;
    }
    window.localStorage.removeItem(key);
  });
};

const writeUnlockToken = (profileId: string, token: string): void => {
  if (typeof window === "undefined" || token.length === 0) {
    return;
  }
  getAuthTokenScopedStorageKeys({
    profileId,
    includeLegacy: true,
  }).forEach((key) => {
    window.localStorage.setItem(key, token);
  });
};

export const getDeviceTrustSnapshot = (profileId: string): DeviceTrustSnapshot => {
  const trusted = readRememberEnabled(profileId);
  const hasUnlockToken = readUnlockTokenCount(profileId) > 0;
  const usesNativeSecureStore = hasNativeRuntime();
  const restorePath: DeviceTrustRestorePath = !trusted
    ? "none"
    : usesNativeSecureStore
      ? "native_session"
      : hasUnlockToken
        ? "device_unlock_token"
        : "none";
  return {
    profileId,
    trusted,
    restorePath,
    hasUnlockToken,
    usesNativeSecureStore,
  };
};

/** @deprecated Use getDeviceTrustSnapshot — kept for session-bootstrap compatibility. */
export const isDeviceTrustEnabledForProfile = (profileId: string): boolean => (
  getDeviceTrustSnapshot(profileId).trusted
);

export const setDeviceTrustEnabled = (profileId: string, trusted: boolean): void => {
  if (!isDeviceSessionTrustPersistenceEnabled()) {
    revokeDeviceTrust(profileId);
    return;
  }
  writeTrustFlag(profileId, trusted);
  if (!trusted) {
    clearUnlockTokens(profileId);
  }
  logAppEvent({
    name: "auth.device_trust_updated",
    level: "info",
    scope: { feature: "auth", action: "device_trust" },
    context: {
      profileId,
      trusted,
      usesNativeSecureStore: hasNativeRuntime(),
    },
  });
};

/**
 * Persist device-trust preference after a successful unlock.
 * Native desktop/mobile: trust flag only — unlock proof lives in OS secure storage.
 * Web/dev: optional passphrase token for auto-unlock when native session is unavailable.
 */
export const persistDeviceUnlockCredential = (params: Readonly<{
  profileId: string;
  trusted: boolean;
  passphrase?: string;
}>): void => {
  if (!isDeviceSessionTrustPersistenceEnabled()) {
    revokeDeviceTrust(params.profileId);
    return;
  }
  writeTrustFlag(params.profileId, params.trusted);
  if (!params.trusted) {
    clearUnlockTokens(params.profileId);
    logAppEvent({
      name: "auth.device_trust_credentials_cleared",
      level: "info",
      scope: { feature: "auth", action: "device_trust" },
      context: { profileId: params.profileId },
    });
    return;
  }

  if (hasNativeRuntime()) {
    clearUnlockTokens(params.profileId);
    logAppEvent({
      name: "auth.device_trust_native_only",
      level: "info",
      scope: { feature: "auth", action: "device_trust" },
      context: {
        profileId: params.profileId,
        tokenPersisted: false,
        restorePath: "native_session",
      },
    });
    return;
  }

  const token = params.passphrase?.trim() ?? "";
  if (token.length > 0) {
    writeUnlockToken(params.profileId, token);
  } else {
    clearUnlockTokens(params.profileId);
  }
  logAppEvent({
    name: "auth.device_trust_web_token_persisted",
    level: "info",
    scope: { feature: "auth", action: "device_trust" },
    context: {
      profileId: params.profileId,
      tokenPersisted: token.length > 0,
      restorePath: token.length > 0 ? "device_unlock_token" : "none",
    },
  });
};

export const revokeDeviceTrust = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  getRememberMeScopedStorageKeys({
    profileId,
    includeLegacy: true,
  }).forEach((key) => {
    removeFromStorages(key);
  });
  if (isDeviceSessionTrustPersistenceEnabled()) {
    writeTrustFlag(profileId, false);
  }
  clearUnlockTokens(profileId);
  logAppEvent({
    name: "auth.device_trust_revoked",
    level: "info",
    scope: { feature: "auth", action: "device_trust" },
    context: { profileId },
  });
};

/**
 * Persist unlock proof after a successful login/import on mobile shell browser.
 * Native runtimes use keychain only — this is a no-op when `hasNativeRuntime()`.
 */
export const persistSessionUnlockAfterSuccess = (params: Readonly<{
  profileId?: string;
  passphrase?: string;
  /** Passwordless hex-key import on mobile shell browser — dev-only unlock token. */
  privateKeyHex?: string;
  trusted?: boolean;
}>): void => {
  const resolvedProfileId = params.profileId?.trim() || getResolvedProfileId();
  const trusted = params.trusted ?? true;

  if (hasNativeRuntime() && isNativeDeviceSessionConsentPersistenceEnabled()) {
    persistDeviceUnlockCredential({
      profileId: resolvedProfileId,
      trusted,
    });
    return;
  }

  if (!SESSION_CREDENTIAL_PERSISTENCE_ENABLED) {
    return;
  }

  const token = params.passphrase?.trim()
    || params.privateKeyHex?.trim()
    || "";
  if (token.length === 0) {
    return;
  }
  persistDeviceUnlockCredential({
    profileId: resolvedProfileId,
    trusted,
    passphrase: token,
  });
};

export const clearDeviceTrustArtifacts = (params?: Readonly<{
  profileId?: string;
  includeLegacy?: boolean;
}>): void => {
  const profileId = params?.profileId?.trim();
  if (!profileId) {
    return;
  }
  revokeDeviceTrust(profileId);
  if (params?.includeLegacy === false) {
    return;
  }
  removeFromStorages(LEGACY_AUTH_TOKEN_KEY);
  removeFromStorages(LEGACY_REMEMBER_ME_KEY);
};
