"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isDesktopShellProduct } from "@/app/features/runtime/shell-contract";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { isProfileWindowUnlockedForAppShell } from "@/app/features/runtime/services/window-runtime-contracts";
import { UnlockedAppRuntimeShell } from "@/app/features/runtime/components/unlocked-app-runtime-shell";
import {
  isAuthPublicDevLabRoute,
  isAuthPublicProfileRoute,
} from "@/app/features/profiles/services/auth-public-routes";
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
  // E20: do not require live bridge alone — flicker of hasNativeRuntime() remounted
  // UnlockedAppRuntimeShell under /profiles (desktop-warmup-progress + heap).
  const isPublicProfileRoute = isAuthPublicProfileRoute(pathname)
    && (isDesktopShellProduct() || hasNativeRuntime());

  // Call-UI lab (and future /lab/*): render fixtures without unlock or messaging shell.
  if (isAuthPublicDevLabRoute(pathname)) {
    return <>{props.children}</>;
  }

  // PL1 / N1: picker must stay light even after keychain rehydrate unlocks the window.
  // Mounting UnlockedAppRuntimeShell on /profiles drove lease/relay/DM IPC storms (E19).
  if (isPublicProfileRoute) {
    return <ProfileManagementShell>{props.children}</ProfileManagementShell>;
  }

  if (isUnlocked) {
    return <UnlockedAppRuntimeShell>{props.children}</UnlockedAppRuntimeShell>;
  }

  return null;
}
