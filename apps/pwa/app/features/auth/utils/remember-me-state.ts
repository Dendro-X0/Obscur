import { getRememberMeScopedStorageKeys } from "./auth-storage-keys";

export const isRememberMeEnabledForProfile = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const rememberKeys = getRememberMeScopedStorageKeys({
    profileId,
    includeLegacy: true,
  });
  return rememberKeys.some((key) => window.localStorage.getItem(key) === "true");
};
