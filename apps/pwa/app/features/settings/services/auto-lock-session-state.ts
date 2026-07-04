import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const AUTOLOCK_STORAGE_KEY = "obscur.autolock.lastActivity";
export const AUTOLOCK_OVERLAY_RESET_EVENT = "obscur-autolock-overlay-reset";

const getAutolockStorageKey = (): string => (
  getScopedStorageKey(AUTOLOCK_STORAGE_KEY, getResolvedProfileId())
);

/** Clears stale inactivity overlay after a fresh identity unlock (prevents double password gate). */
export const resetAutoLockOverlayState = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(getAutolockStorageKey(), String(Date.now()));
  window.dispatchEvent(new Event(AUTOLOCK_OVERLAY_RESET_EVENT));
};
