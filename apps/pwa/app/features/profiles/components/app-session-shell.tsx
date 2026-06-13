"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { UnlockedAppRuntimeShell } from "@/app/features/runtime/components/unlocked-app-runtime-shell";
import { isAuthPublicProfileRoute } from "@/app/features/profiles/services/auth-public-routes";
import { ProfileManagementShell } from "./profile-management-shell";

const isUnlockedRuntimePhase = (phase: string): boolean => (
  phase === "activating_runtime" || phase === "ready" || phase === "degraded"
);

export function AppSessionShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
  const pathname = usePathname();
  const runtime = useWindowRuntime();
  const phase = runtime.snapshot.phase;
  const isUnlocked = isUnlockedRuntimePhase(phase);
  const isPublicProfileRoute = isAuthPublicProfileRoute(pathname) && hasNativeRuntime();

  if (isPublicProfileRoute && !isUnlocked) {
    return <ProfileManagementShell>{props.children}</ProfileManagementShell>;
  }

  if (isUnlocked) {
    return <UnlockedAppRuntimeShell>{props.children}</UnlockedAppRuntimeShell>;
  }

  return null;
}
