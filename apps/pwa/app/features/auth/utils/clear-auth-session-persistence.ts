import {
  getAuthTokenStorageKey,
  getRememberMeStorageKey,
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_REMEMBER_ME_KEY,
} from "./auth-storage-keys";

type ClearAuthSessionPersistenceParams = Readonly<{
  profileId?: string;
  includeLegacy?: boolean;
}>;

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

export const clearAuthSessionPersistence = (params?: ClearAuthSessionPersistenceParams): void => {
  const scopedRememberKey = getRememberMeStorageKey(params?.profileId);
  const scopedTokenKey = getAuthTokenStorageKey(params?.profileId);

  removeFromStorages(scopedTokenKey);
  removeFromStorages(scopedRememberKey);

  if (params?.includeLegacy !== false) {
    removeFromStorages(LEGACY_AUTH_TOKEN_KEY);
    removeFromStorages(LEGACY_REMEMBER_ME_KEY);
  }
};
