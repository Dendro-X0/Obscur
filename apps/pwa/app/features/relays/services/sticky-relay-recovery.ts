"use client";

import type { RelayReadinessState } from "./relay-recovery-policy";
import type { RelayTransportRoutingMode } from "./relay-runtime-contracts";

export const shouldAutoRecoverRelays = (params: Readonly<{
  enabledRelayCount: number;
  writableRelayCount: number;
  fallbackWritableRelayCount?: number;
}>): boolean => {
  return params.enabledRelayCount > 0 && params.writableRelayCount === 0;
};

export const getAutoRecoveryDelayMs = (params: Readonly<{
  readiness: RelayReadinessState;
  recoveryAttemptCount: number;
  fallbackWritableRelayCount?: number;
  transportRoutingMode?: RelayTransportRoutingMode;
}>): number => {
  const fallbackWritableRelayCount = params.fallbackWritableRelayCount ?? 0;
  const privacyRouted = params.transportRoutingMode === "privacy_routed";
  if (fallbackWritableRelayCount > 0) {
    // Keep repairing configured relay coverage in the background, but at a
    // slower cadence while fallback is already carrying traffic.
    return privacyRouted ? 18_000 : 12_000;
  }
  if (params.readiness === "offline") {
    return privacyRouted ? 4_000 : 1_200;
  }
  if (params.readiness === "recovering") {
    if (privacyRouted) {
      return params.recoveryAttemptCount >= 2 ? 9_000 : 6_000;
    }
    return params.recoveryAttemptCount >= 2 ? 3_500 : 2_000;
  }
  if (params.readiness === "degraded") {
    return privacyRouted ? 7_000 : 2_500;
  }
  return privacyRouted ? 8_000 : 4_000;
};
