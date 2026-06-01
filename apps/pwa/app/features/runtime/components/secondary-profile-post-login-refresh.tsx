"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import {
  markProfileWindowSessionEstablished,
} from "@/app/features/auth/services/auth-profile-local-evidence";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { runSecondaryProfileDmSoftRefresh } from "@/app/features/runtime/services/secondary-profile-dm-soft-refresh";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { shouldScheduleSecondaryProfilePostLoginRefresh } from "@/app/features/runtime/services/secondary-profile-post-login-refresh-policy";
import {
  hasSecondaryProfileWindowRefreshDone,
  scheduleSecondaryProfileWindowRefresh,
  SECONDARY_PROFILE_POST_LOGIN_REFRESH_DELAY_MS,
} from "@/app/features/runtime/services/secondary-profile-window-reload-scheduler";

/**
 * Secondary profile windows repair outgoing DM history in-process after login.
 * Avoids full window reload — native chat-state repair + thread re-hydrate only.
 */
export function SecondaryProfilePostLoginRefresh(): null {
  const runtimePhase = useWindowRuntime().snapshot.phase;
  const identityStatus = useIdentity().state.status;
  const identityPublicKeyHex = useIdentity().state.stored?.publicKeyHex;
  const projectionSnapshot = useAccountProjectionSnapshot();
  const desktopSnapshot = useDesktopProfileIsolationSnapshot();
  const profileId = (
    desktopSnapshot.currentWindow.profileId?.trim()
    || getResolvedProfileId()
  ).trim();
  const scheduledForProfileRef = useRef<string | null>(null);

  const runSoftRefresh = useCallback((): void => {
    const myPublicKeyHex = normalizePublicKeyHex(identityPublicKeyHex);
    if (!myPublicKeyHex) {
      return;
    }
    runSecondaryProfileDmSoftRefresh({
      profileId,
      myPublicKeyHex,
      reason: "post_login",
    });
  }, [identityPublicKeyHex, profileId]);

  useEffect(() => {
    if (identityStatus === "unlocked" && profileId) {
      markProfileWindowSessionEstablished(profileId);
    }
  }, [identityStatus, profileId]);

  useEffect(() => {
    const alreadyRefreshed = hasSecondaryProfileWindowRefreshDone("post_login", profileId);
    const shouldSchedule = shouldScheduleSecondaryProfilePostLoginRefresh({
      isNativeRuntime: hasNativeRuntime(),
      profileId,
      identityStatus,
      runtimePhase,
      alreadyRefreshed,
    }) && projectionSnapshot.accountProjectionReady;

    if (!shouldSchedule) {
      scheduledForProfileRef.current = null;
      return;
    }

    if (scheduledForProfileRef.current === profileId) {
      return;
    }
    scheduledForProfileRef.current = profileId;

    scheduleSecondaryProfileWindowRefresh({
      reason: "post_login",
      profileId,
      delayMs: SECONDARY_PROFILE_POST_LOGIN_REFRESH_DELAY_MS,
      onRefresh: runSoftRefresh,
    });

    return () => {
      if (scheduledForProfileRef.current === profileId) {
        scheduledForProfileRef.current = null;
      }
    };
  }, [
    identityStatus,
    profileId,
    projectionSnapshot.accountProjectionReady,
    runSoftRefresh,
    runtimePhase,
  ]);

  return null;
}
