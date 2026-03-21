"use client";

import React, { useEffect, useState } from "react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";

const PROFILE_REFRESH_RETRY_MS = 30_000;
const PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS = 8_000;

export function DesktopProfileBootstrap(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
  // Keep first render deterministic between server and client to avoid hydration drift.
  const [bootstrapSettled, setBootstrapSettled] = useState<boolean>(false);

  useEffect(() => {
    if (!hasNativeRuntime()) {
      setBootstrapSettled(true);
      return;
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
        console.warn(
          "[DesktopProfileBootstrap] Profile resolution exceeded startup deadline; continuing with fallback profile scope.",
        );
        scheduleRetry();
        return;
      }
      const refreshError = desktopProfileRuntime.getLastRefreshError();
      settleFirstAttempt();
      if (refreshError) {
        console.error("[DesktopProfileBootstrap] Failed to resolve window profile binding:", new Error(refreshError));
        scheduleRetry();
      }
    };

    void refreshProfileBinding();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      firstAttemptSettled = true;
    };
  }, []);

  if (!bootstrapSettled) {
    return null;
  }

  return <>{props.children}</>;
}

export const desktopProfileBootstrapInternals = {
  PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS,
  PROFILE_REFRESH_RETRY_MS,
};
