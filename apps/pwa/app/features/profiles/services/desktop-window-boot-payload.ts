import type { ProfileLaunchMode } from "./profile-isolation-contracts";

export type DesktopWindowBootPayload = Readonly<{
  windowLabel: string;
  profileId: string;
  launchMode?: ProfileLaunchMode;
}>;

type WindowWithBootPayload = Window & {
  __OBSCUR_WINDOW_BOOT__?: Partial<DesktopWindowBootPayload>;
  __OBSCUR_SYNC_PROFILE_SCOPE__?: string;
};

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
  (window as WindowWithBootPayload).__OBSCUR_SYNC_PROFILE_SCOPE__ = payload.profileId;
  try {
    window.localStorage.setItem(
      `obscur.desktop.window_profile.last_known.v1::${payload.windowLabel}`,
      payload.profileId,
    );
  } catch {
    // Best-effort only.
  }
  return true;
};
