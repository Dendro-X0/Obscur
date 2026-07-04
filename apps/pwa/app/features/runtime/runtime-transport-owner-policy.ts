"use client";

import { getIdentitySnapshot } from "@/app/features/auth/hooks/use-identity";
import { windowRuntimeSupervisor } from "./services/window-runtime-supervisor";

const ACTIVE_RUNTIME_TRANSPORT_PHASES = new Set([
  "activating_runtime",
  "ready",
  "degraded",
]);

/**
 * True when relay + DM transport owners may run.
 * Desktop static shell can show unlocked chat while window phase is still auth_required.
 */
export const isRuntimeTransportOwnerEnabled = (): boolean => {
  const phase = windowRuntimeSupervisor.getSnapshot().phase;
  if (ACTIVE_RUNTIME_TRANSPORT_PHASES.has(phase)) {
    return true;
  }
  return getIdentitySnapshot().status === "unlocked";
};
