"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { isProfileWindowUnlockedForAppShell } from "@/app/features/runtime/services/window-runtime-contracts";
import { UnlockedAppRuntimeShell } from "@/app/features/runtime/components/unlocked-app-runtime-shell";
import { isAuthPublicProfileRoute } from "@/app/features/profiles/services/auth-public-routes";
import { ProfileManagementShell } from "./profile-management-shell";

export function AppSessionShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element | null {
  const pathname = usePathname();
  const identity = useIdentity();
  const runtime = useWindowRuntime();
  const isUnlocked = isProfileWindowUnlockedForAppShell({
    identityStatus: identity.state.status,
    publicKeyHex: identity.state.publicKeyHex,
    runtimePhase: runtime.snapshot.phase,
  });
  const isPublicProfileRoute = isAuthPublicProfileRoute(pathname) && hasNativeRuntime();

  if (isPublicProfileRoute && !isUnlocked) {
    return <ProfileManagementShell>{props.children}</ProfileManagementShell>;
  }

  if (isUnlocked) {
    return <UnlockedAppRuntimeShell>{props.children}</UnlockedAppRuntimeShell>;
  }

  return null;
}
