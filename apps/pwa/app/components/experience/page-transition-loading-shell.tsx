"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import type { RouteSurface } from "../page-transition-recovery";
import { getRouteSurfaceFromPathname } from "../page-transition-recovery";
import { shouldRenderLaneXExperience } from "./lane-x-experience-policy";

type PageTransitionLoadingShellProps = Readonly<{
  visible: boolean;
  pathname?: string;
  surface?: RouteSurface;
}>;

const surfaceLabel = (surface: RouteSurface): string => {
  switch (surface) {
    case "chats":
      return "Messages";
    case "network":
      return "Network";
    case "groups":
      return "Community";
    case "search":
      return "Search";
    case "settings":
      return "Settings";
    case "vault":
      return "Vault";
    case "requests":
      return "Requests";
    case "invites":
      return "Invites";
    case "profile":
      return "Profile";
    default:
      return "View";
  }
};

export function PageTransitionLoadingShell({
  visible,
  pathname,
  surface,
}: PageTransitionLoadingShellProps): React.JSX.Element | null {
  if (!shouldRenderLaneXExperience()) {
    return null;
  }

  const resolvedSurface = surface
    ?? (pathname ? getRouteSurfaceFromPathname(pathname) : "unknown");

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center",
        "bg-gradient-to-br from-zinc-200/35 via-transparent to-zinc-300/20",
        "dark:from-zinc-100/10 dark:to-zinc-900/20",
        "transition-opacity duration-150 motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "rounded-2xl border border-zinc-300/50 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-md",
          "dark:border-white/10 dark:bg-zinc-950/70",
          "transition-all duration-150 motion-reduce:transition-none",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.98] opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-8 w-8 rounded-full border-2 border-purple-500/30 border-t-purple-500",
              visible && "motion-safe:obscur-indeterminate-spin",
            )}
          />
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Opening {surfaceLabel(resolvedSurface)}
            </div>
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
              Preparing layout...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
