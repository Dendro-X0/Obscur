"use client";

import type React from "react";
import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";
import { cn } from "@/app/lib/cn";
import { isMobileShellProduct } from "../shell-contract";
import { isExperimentOnlineEnabled, isExperimentShellEnabled } from "../experiment-shell-policy";

/** Dev-only badge so manual QA can confirm experiment mode is active. */
export function ExperimentShellIndicator(): React.JSX.Element | null {
  if (!isExperimentShellEnabled()) {
    return null;
  }
  const online = isExperimentOnlineEnabled();
  const mobileShell = isMobileShellProduct();
  return (
    <div
      aria-hidden
      data-testid="experiment-shell-indicator"
      data-experiment-online={online ? "1" : "0"}
      className={cn(
        "pointer-events-none fixed right-2 z-[9999] max-w-[calc(100vw-1rem)] truncate rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200",
        mobileShell
          ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]"
          : "bottom-2",
      )}
    >
      {online ? `Build ${CLIENT_BUILD_STAMP} · online` : `Build ${CLIENT_BUILD_STAMP} · offline-stub`}
    </div>
  );
}
