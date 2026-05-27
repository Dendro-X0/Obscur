"use client";

import type React from "react";
import { RelayReadinessInlineBanner } from "./relay-readiness-inline-banner";

/**
 * App-wide relay transport notice when connectivity is degraded, recovering, or exhausted.
 */
export function RelayTransportShellBanner(): React.JSX.Element | null {
  return (
    <RelayReadinessInlineBanner className="mx-3 mt-2 shrink-0 md:mx-4" />
  );
}
