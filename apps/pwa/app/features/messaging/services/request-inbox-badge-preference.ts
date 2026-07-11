import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const STORAGE_KEY = "messaging.requests-pending-badge-dismissed.v1";

export const readRequestsPendingBadgeDismissed = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
};

export const writeRequestsPendingBadgeDismissed = (dismissed: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (dismissed) {
      window.localStorage.setItem(getScopedStorageKey(STORAGE_KEY), "1");
      return;
    }
    window.localStorage.removeItem(getScopedStorageKey(STORAGE_KEY));
  } catch {
    // ignore storage failures
  }
};
