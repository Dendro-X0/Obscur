"use client";

import type { RelayReadinessState } from "./relay-recovery-policy";

export const shouldAutoRecoverRelays = (params: Readonly<{
  enabledRelayCount: number;
  writableRelayCount: number;
}>): boolean => {
  return params.enabledRelayCount > 0 && params.writableRelayCount === 0;
};

export const getAutoRecoveryDelayMs = (params: Readonly<{
  readiness: RelayReadinessState;
  recoveryAttemptCount: number;
}>): number => {
  if (params.readiness === "offline") {
    return 1_200;
  }
  if (params.readiness === "recovering") {
    return params.recoveryAttemptCount >= 2 ? 3_500 : 2_000;
  }
  if (params.readiness === "degraded") {
    return 2_500;
  }
  return 4_000;
};
