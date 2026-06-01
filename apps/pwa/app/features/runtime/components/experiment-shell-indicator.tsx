"use client";

import type React from "react";
import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";
import { isExperimentOnlineEnabled, isExperimentShellEnabled } from "../experiment-shell-policy";

/** Dev-only badge so manual QA can confirm experiment mode is active. */
export function ExperimentShellIndicator(): React.JSX.Element | null {
  if (!isExperimentShellEnabled()) {
    return null;
  }
  const online = isExperimentOnlineEnabled();
  return (
    <div
      aria-hidden
      data-testid="experiment-shell-indicator"
      data-experiment-online={online ? "1" : "0"}
      className="pointer-events-none fixed bottom-2 right-2 z-[9999] rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200"
    >
      {online ? `Build ${CLIENT_BUILD_STAMP} · online` : `Build ${CLIENT_BUILD_STAMP}`}
    </div>
  );
}
