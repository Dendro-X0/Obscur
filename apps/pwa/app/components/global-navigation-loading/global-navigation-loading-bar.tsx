"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";

type GlobalNavigationLoadingBarProps = Readonly<{
  visible: boolean;
  progress: number;
  completing: boolean;
}>;

export function GlobalNavigationLoadingBar(props: GlobalNavigationLoadingBarProps): React.JSX.Element {
  const widthPercent = Math.min(100, Math.max(0, props.progress));

  return (
    <div
      role="progressbar"
      aria-hidden={!props.visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(widthPercent)}
      aria-busy={props.visible && !props.completing}
      className={cn(
        "sr-only pointer-events-none fixed left-0 right-0 h-[3px] overflow-hidden",
        "top-[max(env(safe-area-inset-top),0px)] desktop-mode:top-12",
      )}
    >
      <div
        className={cn(
          "h-full origin-left bg-gradient-to-r from-purple-500 via-violet-400 to-fuchsia-400 shadow-[0_0_12px_oklch(0.62_0.22_290_/_0.55)]",
          "transition-[width,opacity] ease-out motion-reduce:transition-none",
          props.completing ? "duration-200" : "duration-300",
        )}
        style={{ width: `${widthPercent}%` }}
      />
      {!props.completing && props.visible ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent motion-safe:animate-[global-nav-loading-shimmer_1.1s_ease-in-out_infinite] motion-reduce:hidden"
          style={{ left: `${Math.max(0, widthPercent - 18)}%` }}
        />
      ) : null}
    </div>
  );
}
