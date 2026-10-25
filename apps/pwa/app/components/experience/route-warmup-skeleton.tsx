"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import type { RouteSurface } from "../page-transition-recovery";
import { getRouteSurfaceFromPathname } from "../page-transition-recovery";
import { laneXStaggerDelayMs } from "./lane-x-experience-policy";

type RouteWarmupSkeletonProps = Readonly<{
  title?: string;
  detail?: string;
  surface?: RouteSurface;
  pathname?: string;
  className?: string;
  /** Hide the Obscur title chrome (for in-page panel loaders). */
  compactChrome?: boolean;
}>;

const SkeletonBlock = (props: Readonly<{
  className?: string;
  delayIndex?: number;
}>): React.JSX.Element => (
  <div
    aria-hidden="true"
    className={cn(
      "rounded-lg bg-zinc-200/80 obscur-skeleton-shimmer dark:bg-zinc-800/80",
      props.className,
    )}
    style={{ animationDelay: `${laneXStaggerDelayMs(props.delayIndex ?? 0)}ms` }}
  />
);

const ChatListSkeleton = (): React.JSX.Element => (
  <div className="flex flex-col gap-3 p-4">
    {[0, 1, 2, 3].map((index) => (
      <div key={index} className="flex items-start gap-3">
        <SkeletonBlock className="h-12 w-12 shrink-0 rounded-full" delayIndex={index} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
          <SkeletonBlock className="h-3 w-1/3" delayIndex={index + 1} />
          <SkeletonBlock className="h-3 w-4/5" delayIndex={index + 2} />
        </div>
      </div>
    ))}
  </div>
);

const NetworkSkeleton = (): React.JSX.Element => (
  <div className="flex flex-col gap-4 p-4">
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((index) => (
        <SkeletonBlock key={index} className="h-9 rounded-xl" delayIndex={index} />
      ))}
    </div>
    {[0, 1].map((index) => (
      <SkeletonBlock key={index} className="h-24 rounded-2xl" delayIndex={index + 3} />
    ))}
  </div>
);

/** Full settings route warm-up — mirrors mobile list + desktop sidebar/content. */
const SettingsSkeleton = (): React.JSX.Element => (
  <div className="flex flex-col gap-5 p-3 sm:p-4 md:grid md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-6">
    <div className="flex flex-col gap-4 md:gap-3" data-testid="settings-skeleton-nav">
      <SkeletonBlock className="h-10 w-full rounded-xl md:mb-1" delayIndex={0} />
      {[0, 1].map((group) => (
        <div key={group} className="space-y-2">
          <SkeletonBlock className="ml-1 h-2.5 w-20 rounded" delayIndex={group + 1} />
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white/50 dark:border-zinc-800 dark:bg-zinc-900/40">
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className={cn(
                  "flex items-center gap-3 px-3 py-3",
                  row < 2 && "border-b border-zinc-200/60 dark:border-zinc-800/80",
                )}
              >
                <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" delayIndex={group * 3 + row} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <SkeletonBlock className="h-3 w-28" delayIndex={group * 3 + row + 1} />
                  <SkeletonBlock className="h-2.5 w-16 md:hidden" delayIndex={group * 3 + row + 2} />
                </div>
                <SkeletonBlock className="h-3 w-3 shrink-0 rounded-full md:hidden" delayIndex={group * 3 + row} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="hidden flex-col gap-4 md:flex" data-testid="settings-skeleton-panel">
      <SkeletonBlock className="h-7 w-36 rounded-lg" delayIndex={2} />
      <SkeletonBlock className="h-28 rounded-2xl" delayIndex={3} />
      <SkeletonBlock className="h-36 rounded-2xl" delayIndex={4} />
      <SkeletonBlock className="h-24 rounded-2xl" delayIndex={5} />
    </div>
  </div>
);

/**
 * In-panel settings tab loader — content cards only (no second settings chrome).
 */
export const SettingsPanelContentSkeleton = (): React.JSX.Element => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    data-testid="settings-panel-content-skeleton"
    className="flex flex-col gap-4 p-1 sm:p-2"
  >
    <div className="space-y-2">
      <SkeletonBlock className="h-6 w-40 rounded-lg" delayIndex={0} />
      <SkeletonBlock className="h-3 w-2/3 max-w-sm rounded" delayIndex={1} />
    </div>
    <div className="overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className={cn(
            "flex items-center justify-between gap-3 px-4 py-3.5",
            row < 2 && "border-b border-zinc-200/70 dark:border-zinc-800",
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <SkeletonBlock className="h-3.5 w-28" delayIndex={row + 1} />
            <SkeletonBlock className="h-2.5 w-44 max-w-full" delayIndex={row + 2} />
          </div>
          <SkeletonBlock className="h-7 w-12 shrink-0 rounded-full" delayIndex={row + 3} />
        </div>
      ))}
    </div>
    <SkeletonBlock className="h-32 rounded-2xl" delayIndex={4} />
    <SkeletonBlock className="h-24 rounded-2xl" delayIndex={5} />
  </div>
);

const VaultSkeleton = (): React.JSX.Element => (
  <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
    {Array.from({ length: 8 }, (_, index) => (
      <SkeletonBlock key={index} className="aspect-square rounded-[24px]" delayIndex={index % 4} />
    ))}
  </div>
);

const GenericSkeleton = (): React.JSX.Element => (
  <div className="flex flex-col gap-4 p-4">
    <SkeletonBlock className="h-8 w-2/5 rounded-lg" delayIndex={0} />
    {[0, 1, 2].map((index) => (
      <SkeletonBlock key={index} className="h-16 rounded-2xl" delayIndex={index + 1} />
    ))}
  </div>
);

const surfaceSkeleton = (surface: RouteSurface): React.JSX.Element => {
  switch (surface) {
    case "chats":
      return <ChatListSkeleton />;
    case "network":
    case "groups":
    case "search":
    case "requests":
    case "invites":
      return <NetworkSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "vault":
      return <VaultSkeleton />;
    default:
      return <GenericSkeleton />;
  }
};

export function RouteWarmupSkeleton({
  title = "Opening",
  detail = "Opening from this device…",
  surface,
  pathname,
  className,
  compactChrome = false,
}: RouteWarmupSkeletonProps): React.JSX.Element {
  const resolvedSurface = surface
    ?? (pathname ? getRouteSurfaceFromPathname(pathname) : "unknown");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        // Opaque — translucent fills let the previous route / shell chrome bleed through.
        "flex h-full min-h-[320px] w-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100",
        className,
      )}
    >
      {compactChrome ? (
        // Under AppShell: keep title/detail, skip second "Obscur" brand chrome.
        <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800/80">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{detail}</div>
        </div>
      ) : (
        <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800/80">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Obscur</div>
          <div className="mt-1 text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{detail}</div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {resolvedSurface === "settings" && compactChrome
          ? <SettingsPanelContentSkeleton />
          : surfaceSkeleton(resolvedSurface)}
      </div>
    </div>
  );
}
