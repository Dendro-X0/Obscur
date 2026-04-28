"use client";

import Image from "next/image";
import type React from "react";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/app/features/auth/components/auth-screen";
import { Button } from "@dweb/ui-kit";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { logAppEvent } from "@/app/shared/log-app-event";

const PROFILE_BOOT_STALL_TIMEOUT_MS = 12_000;

export function ProfileBoundAuthShell(): React.JSX.Element {
  const runtimeActions = useWindowRuntime();
  const runtime = runtimeActions.snapshot;
  const startupState = runtime.session.startupState;
  const [profileBootStalled, setProfileBootStalled] = useState(false);

  useEffect(() => {
    const isPendingProfileBoot = startupState.kind === "pending" && (runtime.phase === "booting" || runtime.phase === "binding_profile");
    if (!isPendingProfileBoot) {
      setProfileBootStalled(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setProfileBootStalled(true);
      logAppEvent({
        name: "runtime.profile_boot_stall_timeout",
        level: "warn",
        scope: { feature: "runtime", action: "profile_boot" },
        context: {
          phase: runtime.phase,
          timeoutMs: PROFILE_BOOT_STALL_TIMEOUT_MS,
        },
      });
    }, PROFILE_BOOT_STALL_TIMEOUT_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [runtime.phase, startupState.kind]);

  if (startupState.kind === "pending" && (runtime.phase === "booting" || runtime.phase === "binding_profile") && !profileBootStalled) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <Image src="/obscur-logo-light.svg" alt="Loading" width={80} height={80} className="animate-pulse dark:hidden" priority />
          <Image src="/obscur-logo-dark.svg" alt="Loading" width={80} height={80} className="hidden animate-pulse dark:block" priority />
        </div>
      </div>
    );
  }

  if (startupState.kind === "pending" && (runtime.phase === "booting" || runtime.phase === "binding_profile")) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 text-zinc-700 dark:bg-black dark:text-zinc-200">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white/80 px-5 py-4 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5">
          <p>Profile startup is taking longer than expected.</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            This can happen after account/key switching. Continue to login to recover this window.
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void runtimeActions.refreshWindowBinding();
              }}
            >
              Retry Binding
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                runtimeActions.lockBoundProfile();
              }}
            >
              Continue to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (runtime.phase === "fatal") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 text-zinc-700 dark:bg-black dark:text-zinc-200">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white/80 px-5 py-4 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5">
          <p>{startupState.message || runtime.lastError || "Profile runtime failed to start."}</p>
          <div className="mt-4 flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                runtimeActions.lockBoundProfile();
              }}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AuthScreen />;
}
