"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";
import type { RouteSurface } from "../page-transition-recovery";
import { getRouteSurfaceFromPathname } from "../page-transition-recovery";
import { laneXStaggerDelayMs, shouldRenderLaneXExperience } from "./lane-x-experience-policy";

type RouteWarmupSkeletonProps = Readonly<{
  title?: string;
  detail?: string;
  surface?: RouteSurface;
  pathname?: string;
  className?: string;
}>;

const SkeletonBlock = (props: Readonly<{
  className?: string;
  delayIndex?: number;
}>): React.JSX.Element => (
  <div
    aria-hidden="true"
    className={cn(
      "rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80",
      shouldRenderLaneXExperience() && "motion-safe:animate-pulse",
      props.className,
    )}
    style={shouldRenderLaneXExperience() ? { animationDelay: `${laneXStaggerDelayMs(props.delayIndex ?? 0)}ms` } : undefined}
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

const SettingsSkeleton = (): React.JSX.Element => (
  <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3, 4].map((index) => (
        <SkeletonBlock key={index} className="h-10 rounded-xl" delayIndex={index} />
      ))}
    </div>
    <div className="flex flex-col gap-3">
      <SkeletonBlock className="h-8 w-2/5 rounded-lg" delayIndex={1} />
      <SkeletonBlock className="h-32 rounded-2xl" delayIndex={2} />
      <SkeletonBlock className="h-32 rounded-2xl" delayIndex={3} />
    </div>
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
  title = "Loading page",
  detail = "Preparing view...",
  surface,
  pathname,
  className,
}: RouteWarmupSkeletonProps): React.JSX.Element {
  const resolvedSurface = surface
    ?? (pathname ? getRouteSurfaceFromPathname(pathname) : "generic");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex h-full min-h-[320px] w-full flex-col bg-zinc-50/90 text-zinc-900 dark:bg-black/40 dark:text-zinc-100",
        className,
      )}
    >
      <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800/80">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Obscur</div>
        <div className="mt-1 text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{detail}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {surfaceSkeleton(resolvedSurface)}
      </div>
    </div>
  );
}
