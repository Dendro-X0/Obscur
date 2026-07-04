import type { ProfileLaunchMode } from "./profile-isolation-contracts";
import { resolveDesktopWindowProfileScope } from "./resolve-desktop-window-profile-scope";

export type DesktopWindowBootPayload = Readonly<{
  windowLabel: string;
  profileId: string;
  launchMode?: ProfileLaunchMode;
}>;

type WindowWithBootPayload = Window & {
  __OBSCUR_WINDOW_BOOT__?: Partial<DesktopWindowBootPayload>;
  __OBSCUR_SYNC_PROFILE_SCOPE__?: string;
};

const lastKnownWindowProfileIdStorageKey = (windowLabel: string): string => (
  `obscur.desktop.window_profile.last_known.v1::${windowLabel.trim()}`
);

const readLastKnownWindowProfileId = (windowLabel: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const cached = window.localStorage.getItem(lastKnownWindowProfileIdStorageKey(windowLabel))?.trim();
    return cached && cached.length > 0 ? cached : null;
  } catch {
    return null;
  }
};

/** On manual refresh, last-known wins unless it is a stale `default` clobber. */
export const resolveDesktopWindowBootProfileId = (payload: DesktopWindowBootPayload): string => (
  resolveDesktopWindowProfileScope(
    readLastKnownWindowProfileId(payload.windowLabel),
    payload.profileId,
  )
);

/** Injected by Tauri `initialization_script` before the page bundle loads. */
export const readDesktopWindowBootPayload = (): DesktopWindowBootPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = (window as WindowWithBootPayload).__OBSCUR_WINDOW_BOOT__;
  const windowLabel = typeof raw?.windowLabel === "string" ? raw.windowLabel.trim() : "";
  const profileId = typeof raw?.profileId === "string" ? raw.profileId.trim() : "";
  const launchMode = raw?.launchMode === "new_window" || raw?.launchMode === "existing"
    ? raw.launchMode
    : undefined;
  if (!windowLabel || !profileId) {
    return null;
  }
  return { windowLabel, profileId, launchMode };
};

/** Mirrors init payload into sync scope read by {@link getProfileScopeOverride}. */
export const mirrorDesktopWindowBootPayloadToSyncScope = (): boolean => {
  const payload = readDesktopWindowBootPayload();
  if (!payload) {
    return false;
  }
  const cacheKey = lastKnownWindowProfileIdStorageKey(payload.windowLabel);
  let cached: string | null = null;
  try {
    cached = window.localStorage.getItem(cacheKey);
  } catch {
    // Best-effort only.
  }
  const profileId = resolveDesktopWindowProfileScope(cached, payload.profileId);
  (window as WindowWithBootPayload).__OBSCUR_SYNC_PROFILE_SCOPE__ = profileId;
  try {
    window.localStorage.setItem(cacheKey, profileId);
  } catch {
    // Best-effort only.
  }
  return true;
};

export const resolveCurrentDesktopWindowLabel = (): string => (
  readDesktopWindowBootPayload()?.windowLabel?.trim() || "main"
);
