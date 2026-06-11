"use client";

import { useEffect, useRef } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { logAppEvent } from "@/app/shared/log-app-event";
import { hasNativeRuntime } from "../runtime-capabilities";
import {
  listenDesktopWarmupProgress,
  startDesktopWarmup,
  type DesktopWarmupStatus,
} from "../services/desktop-warmup-service";

const logWarmupSnapshot = (status: DesktopWarmupStatus): void => {
  logAppEvent({
    name: "desktop_warmup_progress",
    level: "info",
    scope: { feature: "runtime", action: "desktop_warmup" },
    context: {
      profileId: status.profileId,
      phase: status.phase,
      completedCount: status.completedCount,
      totalTasks: status.totalTasks,
      elapsedMs: status.elapsedMs,
      currentTask: status.currentTask,
      error: status.error,
    },
  });
};

/**
 * Native desktop account warm-up owner. Primes SQLite account reads off the WebView
 * main thread while the user waits through first-login activation.
 */
export function DesktopWarmupOwner(): null {
  const { profileId } = useProfileRuntime();
  const publicKeyHex = useIdentity().state.publicKeyHex;
  const startedForProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasNativeRuntime() || !publicKeyHex || !profileId.trim()) {
      return;
    }
    if (startedForProfileRef.current === profileId) {
      return;
    }
    startedForProfileRef.current = profileId;

    let disposeProgressListener: (() => void) | null = null;
    let cancelled = false;

    void listenDesktopWarmupProgress((status) => {
      if (cancelled || status.profileId !== profileId) {
        return;
      }
      logWarmupSnapshot(status);
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
        return;
      }
      disposeProgressListener = unlisten;
    });

    void startDesktopWarmup(profileId).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        logAppEvent({
          name: "desktop_warmup_start_failed",
          level: "warn",
          scope: { feature: "runtime", action: "desktop_warmup" },
          context: {
            profileId,
            reason: result.reason,
            message: result.message ?? null,
          },
        });
        return;
      }
      logWarmupSnapshot(result.value);
    });

    return () => {
      cancelled = true;
      disposeProgressListener?.();
    };
  }, [profileId, publicKeyHex]);

  return null;
}
