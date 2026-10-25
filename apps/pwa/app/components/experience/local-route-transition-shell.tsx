"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import {
  getRouteSurfaceFromPathname,
  type RouteSurface,
} from "../page-transition-recovery";
import {
  pathnameMatchesNavTarget,
  type GlobalNavLoadingRenderState,
} from "../global-navigation-loading/global-navigation-loading-state";
import { RouteWarmupSkeleton } from "./route-warmup-skeleton";

const SURFACE_TITLE: Record<RouteSurface, string> = {
  chats: "Messages",
  network: "Network",
  groups: "Community",
  search: "Search",
  settings: "Settings",
  vault: "Vault",
  requests: "Requests",
  invites: "Invites",
  profile: "Profile",
  download: "Download",
  unknown: "View",
};

/** Local-first: paint target skeleton before the App Router commits the new pathname. */
export const shouldShowLocalRouteTransitionShell = (
  navState: GlobalNavLoadingRenderState,
  currentPathname: string,
): boolean => {
  if (!navState.visible || navState.completing || !navState.targetPathname) {
    return false;
  }
  return !pathnameMatchesNavTarget(currentPathname, navState.targetPathname);
};

type LocalRouteTransitionShellProps = Readonly<{
  navState: GlobalNavLoadingRenderState;
  currentPathname: string;
  className?: string;
}>;

/**
 * Instant on-device route shell — independent of relay/network and of Next route commit.
 * Does not use Lane X / experiment progress gates.
 */
export function LocalRouteTransitionShell(
  props: LocalRouteTransitionShellProps,
): React.JSX.Element | null {
  if (!shouldShowLocalRouteTransitionShell(props.navState, props.currentPathname)) {
    return null;
  }

  const target = props.navState.targetPathname!;
  const surface = getRouteSurfaceFromPathname(target);
  const title = SURFACE_TITLE[surface] ?? "View";

  return (
    <div
      data-testid="local-route-transition-shell"
      className={cn(
        // Above route children; below sticky AppShell header (z-20) and tab bar (z-50).
        "absolute inset-0 z-[15] flex min-h-0 flex-col overflow-hidden bg-background",
        props.className,
      )}
      aria-busy="true"
    >
      <RouteWarmupSkeleton
        title={title}
        detail="Opening from this device…"
        surface={surface}
        pathname={target}
        compactChrome
        className="min-h-full bg-background"
      />
    </div>
  );
}
