"use client";

import React, { useEffect, useState } from "react";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";

const PROFILE_REFRESH_RETRY_MS = 30_000;

export function DesktopProfileBootstrap(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasNativeRuntime()) {
      setReady(true);
      return;
    }
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const refreshProfileBinding = async (): Promise<void> => {
      await desktopProfileRuntime.refresh();
      if (disposed) {
        return;
      }
      const refreshError = desktopProfileRuntime.getLastRefreshError();
      if (refreshError) {
        console.error("[DesktopProfileBootstrap] Failed to resolve window profile binding:", new Error(refreshError));
        retryTimer = setTimeout(() => {
          void refreshProfileBinding();
        }, PROFILE_REFRESH_RETRY_MS);
      }
      setReady(true);
    };

    void refreshProfileBinding();

    return () => {
      disposed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 text-zinc-700 dark:bg-black dark:text-zinc-200">
        <div className="rounded-2xl border border-black/10 bg-white/80 px-5 py-4 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5">
          Resolving desktop profile...
        </div>
      </div>
    );
  }

  return <>{props.children}</>;
}
