import { getDefaultProfileId } from "@/app/features/profiles/services/profile-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isSecondaryProfileWindow } from "./secondary-profile-post-login-refresh-policy";

export type SecondaryProfileWindowRefreshReason = "post_login" | "dm_incoming_only";

export const SECONDARY_PROFILE_POST_LOGIN_REFRESH_DELAY_MS = 2_500;
export const SECONDARY_PROFILE_DM_INCOMING_ONLY_REFRESH_DELAY_MS = 800;

const refreshStorageKey = (
  reason: SecondaryProfileWindowRefreshReason,
  profileId: string,
): string => (
  `obscur.secondary_profile.refresh.${reason}.v1::${profileId.trim() || getDefaultProfileId()}`
);

const pendingTimers = new Map<string, number>();

export const hasSecondaryProfileWindowRefreshDone = (
  reason: SecondaryProfileWindowRefreshReason,
  profileId: string,
): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(refreshStorageKey(reason, profileId)) === "1";
  } catch {
    return false;
  }
};

const markSecondaryProfileWindowRefreshDone = (
  reason: SecondaryProfileWindowRefreshReason,
  profileId: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(refreshStorageKey(reason, profileId), "1");
  } catch {
    // ignore
  }
};

/** @deprecated Use hasSecondaryProfileWindowRefreshDone */
export const hasSecondaryProfileWindowReloadDone = hasSecondaryProfileWindowRefreshDone;

/**
 * Schedules a one-time in-process DM refresh for secondary profile slots (non-default).
 * Avoids full window reload — callers supply the refresh action (native repair + re-hydrate).
 */
export const scheduleSecondaryProfileWindowRefresh = (params: Readonly<{
  reason: SecondaryProfileWindowRefreshReason;
  profileId: string;
  delayMs: number;
  onRefresh: () => void;
}>): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  if (!hasNativeRuntime()) {
    return false;
  }
  const profileId = params.profileId.trim();
  if (!isSecondaryProfileWindow(profileId)) {
    return false;
  }
  if (hasSecondaryProfileWindowRefreshDone(params.reason, profileId)) {
    return false;
  }

  const timerKey = `${params.reason}:${profileId}`;
  const existing = pendingTimers.get(timerKey);
  if (existing) {
    window.clearTimeout(existing);
  }

  const timeoutId = window.setTimeout(() => {
    pendingTimers.delete(timerKey);
    markSecondaryProfileWindowRefreshDone(params.reason, profileId);
    logAppEvent({
      name: "runtime.secondary_profile_window_refresh",
      level: "info",
      scope: { feature: "runtime", action: "secondary_profile_refresh" },
      context: {
        profileId,
        reason: params.reason,
        delayMs: params.delayMs,
      },
    });
    params.onRefresh();
  }, params.delayMs);

  pendingTimers.set(timerKey, timeoutId);
  return true;
};

/** @deprecated Use scheduleSecondaryProfileWindowRefresh */
export const scheduleSecondaryProfileWindowReload = (params: Readonly<{
  reason: SecondaryProfileWindowRefreshReason;
  profileId: string;
  delayMs: number;
}>): boolean => scheduleSecondaryProfileWindowRefresh({
  ...params,
  onRefresh: (): void => {
    window.location.reload();
  },
});

export const cancelSecondaryProfileWindowRefresh = (
  reason: SecondaryProfileWindowRefreshReason,
  profileId: string,
): void => {
  const timerKey = `${reason}:${profileId.trim()}`;
  const existing = pendingTimers.get(timerKey);
  if (existing) {
    window.clearTimeout(existing);
    pendingTimers.delete(timerKey);
  }
};

/** @deprecated Use cancelSecondaryProfileWindowRefresh */
export const cancelSecondaryProfileWindowReload = cancelSecondaryProfileWindowRefresh;
