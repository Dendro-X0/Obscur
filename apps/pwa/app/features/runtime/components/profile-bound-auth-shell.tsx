"use client";

import Image from "next/image";
import type React from "react";
import { AuthScreen } from "@/app/features/auth/components/auth-screen";
import { Button } from "@dweb/ui-kit";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";

const LoadingCard = ({ label }: Readonly<{ label: string }>): React.JSX.Element => (
  <div className="flex flex-1 items-center justify-center bg-zinc-50 text-zinc-700 dark:bg-black dark:text-zinc-200">
    <div className="rounded-2xl border border-black/10 bg-white/80 px-5 py-4 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5">
      {label}
    </div>
  </div>
);

export function ProfileBoundAuthShell(): React.JSX.Element {
  const runtimeActions = useWindowRuntime();
  const runtime = runtimeActions.snapshot;

  if (runtime.phase === "booting" || runtime.phase === "binding_profile") {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <Image src="/obscur-logo-light.svg" alt="Loading" width={80} height={80} className="animate-pulse dark:hidden" priority />
          <Image src="/obscur-logo-dark.svg" alt="Loading" width={80} height={80} className="hidden animate-pulse dark:block" priority />
        </div>
      </div>
    );
  }

  if (runtime.phase === "fatal") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 text-zinc-700 dark:bg-black dark:text-zinc-200">
        <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white/80 px-5 py-4 text-sm font-medium shadow-sm dark:border-white/10 dark:bg-white/5">
          <p>{runtime.lastError || "Profile runtime failed to start."}</p>
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
