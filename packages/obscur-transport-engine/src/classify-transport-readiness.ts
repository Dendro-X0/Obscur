import type { TransportReadiness, TransportRecoveryReasonCode } from "./transport-types";

export type ClassifyTransportReadinessParams = Readonly<{
  writableRelayCount: number;
  fallbackWritableRelayCount: number;
  subscribableRelayCount: number;
  recoveryAttemptCount: number;
  recoveryReasonCode?: TransportRecoveryReasonCode;
}>;

/** Sole readiness classifier — relay-recovery-policy must delegate here. */
export const classifyTransportReadiness = (
  params: ClassifyTransportReadinessParams,
): TransportReadiness => {
  if (params.recoveryReasonCode === "startup_warmup") {
    return "recovering";
  }
  if (params.recoveryReasonCode === "recovery_exhausted") {
    return "offline";
  }
  const effectiveWritableRelayCount = params.writableRelayCount + params.fallbackWritableRelayCount;
  if (params.writableRelayCount > 0 && params.subscribableRelayCount > 0) {
    return "healthy";
  }
  if (params.recoveryAttemptCount > 0 && effectiveWritableRelayCount === 0) {
    return "recovering";
  }
  if (effectiveWritableRelayCount > 0 || params.subscribableRelayCount > 0) {
    return "degraded";
  }
  return "offline";
};
