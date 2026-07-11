"use client";

import { getIdentitySnapshot } from "@/app/features/auth/hooks/use-identity";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

type RouteStallRouter = Readonly<{
  push: (href: string) => void;
}>;

export const hardNavigate = (href: string): void => {
  window.location.assign(href);
};

/**
 * Desktop Tauri: do not arm the stall watchdog. A blocked main thread (webpack compile,
 * heavy route mount) cannot be fixed by timer-driven router.push, and extra navigation
 * work worsens WebView2 PostMessage queue pressure on Windows.
 */
export const shouldArmRouteStallWatchdog = (): boolean => !hasNativeRuntime();

/** Desktop sessions lose in-memory unlock on full document navigation. */
export const shouldPreferSoftRouteStallRecovery = (): boolean => {
  if (!hasNativeRuntime()) {
    return false;
  }
  const snapshot = getIdentitySnapshot();
  return snapshot.status === "unlocked" || Boolean(snapshot.stored?.publicKeyHex);
};

export const recoverFromRouteStall = (targetHref: string, router: RouteStallRouter): void => {
  // Desktop Tauri never uses document navigation here — it clears in-memory unlock.
  if (hasNativeRuntime()) {
    router.push(targetHref);
    return;
  }
  if (shouldPreferSoftRouteStallRecovery()) {
    router.push(targetHref);
    return;
  }
  hardNavigate(targetHref);
};
