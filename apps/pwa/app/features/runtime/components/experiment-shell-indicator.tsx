"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";
import { cn } from "@/app/lib/cn";
import { isExperimentOnlineEnabled, isExperimentShellEnabled } from "../experiment-shell-policy";

/**
 * Dev-only badge so manual QA can confirm experiment mode is active.
 * Mount-gated: `isExperimentShellEnabled()` can disagree between SSR and client
 * (window boot flags), which otherwise causes a hydration mismatch.
 *
 * Bottom offset: default `bottom-2`. `AppShell` sets `data-obscur-mobile-chrome`
 * (`tabs` / `thread`) and CSS lifts this badge clear of the tab bar or composer.
 */
export function ExperimentShellIndicator(): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (process.env.NODE_ENV !== "development" || !mounted || !isExperimentShellEnabled()) {
    return null;
  }

  const online = isExperimentOnlineEnabled();
  return (
    <div
      aria-hidden
      data-testid="experiment-shell-indicator"
      data-experiment-online={online ? "1" : "0"}
      className={cn(
        "pointer-events-none fixed right-2 bottom-2 z-[9999] max-w-[calc(100vw-1rem)] truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200",
      )}
    >
      {online ? `Build ${CLIENT_BUILD_STAMP} · online` : `Build ${CLIENT_BUILD_STAMP} · offline-stub`}
    </div>
  );
}
