"use client";

import React, { useEffect, useState } from "react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { logAppEvent } from "@/app/shared/log-app-event";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const PROFILE_REFRESH_RETRY_MS = 30_000;
const PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS = 8_000;
const PROFILE_BOOTSTRAP_FAILSAFE_TIMEOUT_MS = PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS + 4_000;

const markBootReady = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const globalRoot = window as Window & {
    __obscurBootReady?: boolean;
  };
  if (globalRoot.__obscurBootReady === true) {
    return;
  }
  globalRoot.__obscurBootReady = true;
  window.dispatchEvent(new Event("obscur:boot-ready"));
};

export function DesktopProfileBootstrap(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
  // Keep first render deterministic between server and client to avoid hydration drift.
  const [bootstrapSettled, setBootstrapSettled] = useState<boolean>(false);

  useEffect(() => {
    let failsafeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFailsafe = (): void => {
      if (failsafeTimer) {
        clearTimeout(failsafeTimer);
      }
      failsafeTimer = setTimeout(() => {
        setBootstrapSettled((previous) => {
          if (previous) {
            return previous;
          }
          logAppEvent({
            name: "runtime.profile_binding_bootstrap_failsafe_released",
            level: "warn",
            scope: { feature: "runtime", action: "profile_boot" },
            context: {
              reasonCode: "bootstrap_failsafe_timeout",
              timeoutMs: PROFILE_BOOTSTRAP_FAILSAFE_TIMEOUT_MS,
            },
          });
          return true;
        });
      }, PROFILE_BOOTSTRAP_FAILSAFE_TIMEOUT_MS);
    };

    scheduleFailsafe();

    if (!hasNativeRuntime()) {
      setBootstrapSettled(true);
      return () => {
        if (failsafeTimer) {
          clearTimeout(failsafeTimer);
          failsafeTimer = null;
        }
      };
    }
    let disposed = false;
    let firstAttemptSettled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = (): void => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      retryTimer = setTimeout(() => {
        void refreshProfileBinding();
      }, PROFILE_REFRESH_RETRY_MS);
    };

    const settleFirstAttempt = (): void => {
      if (firstAttemptSettled) {
        return;
      }
      firstAttemptSettled = true;
      if (!disposed) {
        setBootstrapSettled(true);
      }
    };

    const refreshWithBootstrapDeadline = async (): Promise<"completed" | "timed_out"> => {
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
      const refreshPromise = desktopProfileRuntime.refresh().then(
        () => "completed" as const,
        () => "completed" as const,
      );
      const timeoutPromise = new Promise<"timed_out">((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve("timed_out");
        }, PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS);
      });
      const outcome = await Promise.race([refreshPromise, timeoutPromise]);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      return outcome;
    };

    const refreshProfileBinding = async (): Promise<void> => {
      const outcome = await refreshWithBootstrapDeadline();
      if (disposed) {
        return;
      }
      if (outcome === "timed_out") {
        settleFirstAttempt();
        const currentProfileId = desktopProfileRuntime.getSnapshot?.().currentWindow.profileId ?? "unknown";
        logAppEvent({
          name: "runtime.profile_binding_refresh_timeout",
          level: "warn",
          scope: { feature: "runtime", action: "profile_boot" },
          context: {
            reasonCode: "profile_binding_refresh_timed_out",
            profileId: currentProfileId,
            bootstrapDeadlineMs: PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS,
            retryInMs: PROFILE_REFRESH_RETRY_MS,
          },
        });
        console.warn(
          "[DesktopProfileBootstrap] Profile resolution exceeded startup deadline; continuing with fallback profile scope.",
        );
        scheduleRetry();
        return;
      }
      const refreshError = desktopProfileRuntime.getLastRefreshError();
      settleFirstAttempt();
      if (refreshError) {
        const currentProfileId = desktopProfileRuntime.getSnapshot?.().currentWindow.profileId ?? "unknown";
        logAppEvent({
          name: "runtime.profile_binding_refresh_failed",
          level: "warn",
          scope: { feature: "runtime", action: "profile_boot" },
          context: {
            reasonCode: "profile_binding_refresh_failed",
            profileId: currentProfileId,
            bootstrapDeadlineMs: PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS,
            retryInMs: PROFILE_REFRESH_RETRY_MS,
            error: refreshError.slice(0, 160),
          },
        });
        console.error("[DesktopProfileBootstrap] Failed to resolve window profile binding:", new Error(refreshError));
        scheduleRetry();
      }
    };

    void refreshProfileBinding();

    return () => {
      disposed = true;
      if (failsafeTimer) {
        clearTimeout(failsafeTimer);
        failsafeTimer = null;
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      firstAttemptSettled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapSettled) {
      return;
    }
    markBootReady();
  }, [bootstrapSettled]);

  if (!bootstrapSettled) {
    return (
      <AppLoadingScreen
        title="Starting Obscur"
        detail="Preparing profile workspace and startup services..."
      />
    );
  }

  return <>{props.children}</>;
}

export const desktopProfileBootstrapInternals = {
  PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS,
  PROFILE_BOOTSTRAP_FAILSAFE_TIMEOUT_MS,
  PROFILE_REFRESH_RETRY_MS,
};
