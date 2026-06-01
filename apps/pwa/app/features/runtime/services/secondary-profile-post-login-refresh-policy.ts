import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";

/** @deprecated Use secondary-profile-window-reload-scheduler */
export const SECONDARY_PROFILE_POST_LOGIN_REFRESH_DELAY_MS = 8_000;

export const secondaryProfilePostLoginRefreshStorageKey = (profileId: string): string => (
  `obscur.secondary_profile.post_login_refresh.done.v1::${profileId.trim() || getDefaultProfileId()}`
);

export const isSecondaryProfileWindow = (profileId: string): boolean => (
  profileId.trim() !== getDefaultProfileId()
);

export const shouldScheduleSecondaryProfilePostLoginRefresh = (params: Readonly<{
  isNativeRuntime: boolean;
  profileId: string;
  identityStatus: "loading" | "locked" | "unlocked" | "error";
  runtimePhase: string;
  alreadyRefreshed: boolean;
}>): boolean => {
  if (!params.isNativeRuntime) {
    return false;
  }
  if (!isSecondaryProfileWindow(params.profileId)) {
    return false;
  }
  if (params.alreadyRefreshed) {
    return false;
  }
  if (params.identityStatus !== "unlocked") {
    return false;
  }
  return params.runtimePhase === "ready" || params.runtimePhase === "degraded";
};

export const markSecondaryProfilePostLoginRefreshDone = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(secondaryProfilePostLoginRefreshStorageKey(profileId), "1");
  } catch {
    // sessionStorage may be unavailable in some embedded runtimes.
  }
};

export const hasSecondaryProfilePostLoginRefreshDone = (profileId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(secondaryProfilePostLoginRefreshStorageKey(profileId)) === "1";
  } catch {
    return false;
  }
};
