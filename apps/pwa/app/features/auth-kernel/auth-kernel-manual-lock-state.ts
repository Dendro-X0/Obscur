import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

/** Profile-scoped sessionStorage flag — survives F5 in the same tab (AUTH-KERN-2). */
const AUTH_KERNEL_MANUAL_LOCK_KEY = "auth.kernel.manual_lock";

const RELOAD_UNLOCKED_HINT_SESSION_KEY = "obscur.reload.was_unlocked.v1";

export const clearReloadUnlockedSessionHint = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(RELOAD_UNLOCKED_HINT_SESSION_KEY);
  } catch {
    // best effort only
  }
};

export const markAuthKernelManualLock = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  sessionStorage.setItem(getScopedStorageKey(AUTH_KERNEL_MANUAL_LOCK_KEY, trimmed), "1");
  clearReloadUnlockedSessionHint();
};

export const clearAuthKernelManualLock = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    return;
  }
  sessionStorage.removeItem(getScopedStorageKey(AUTH_KERNEL_MANUAL_LOCK_KEY, trimmed));
};

export const isAuthKernelManualLockActive = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  const trimmed = profileId.trim();
  if (!trimmed) {
    return false;
  }
  return sessionStorage.getItem(getScopedStorageKey(AUTH_KERNEL_MANUAL_LOCK_KEY, trimmed)) === "1";
};

export const resolveAuthKernelBootRestoreEligible = (profileId: string): boolean => (
  !isAuthKernelManualLockActive(profileId)
);
