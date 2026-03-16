"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";

type AppLoadingScreenProps = Readonly<{
  title?: string;
  detail?: string;
  fullScreen?: boolean;
  className?: string;
}>;

export function AppLoadingScreen({
  title = "Loading Obscur",
  detail = "Preparing runtime and encrypted state...",
  fullScreen = true,
  className,
}: AppLoadingScreenProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-zinc-50/90 px-6 text-zinc-900 dark:bg-black/80 dark:text-zinc-100",
        fullScreen ? "fixed inset-0 z-[200]" : "h-full min-h-[240px] w-full",
        className,
      )}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Obscur</div>
        <div className="mt-3 text-2xl font-semibold">{title}</div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{detail}</div>
      </div>
    </div>
  );
}
