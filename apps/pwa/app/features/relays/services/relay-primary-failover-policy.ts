import type { RelayRecoveryReasonCode, RelayRecoverySnapshot } from "./relay-recovery-types";

const FAILOVER_ON_ZERO_WRITABLE_REASONS: ReadonlySet<RelayRecoveryReasonCode> = new Set([
  "no_writable_relays",
  "publish_timeouts",
  "stale_subscriptions",
  "write_queue_blocked",
  "stale_event_flow",
]);

export const shouldAttemptPrimaryFailover = (params: Readonly<{
  allEnabledRelayCount: number;
  writableRelayCount: number;
  recovery: Pick<RelayRecoverySnapshot, "recoveryReasonCode" | "recoveryAttemptCount">;
  recoveryReason?: RelayRecoveryReasonCode;
}>): boolean => {
  if (params.allEnabledRelayCount <= 1 || params.writableRelayCount > 0) {
    return false;
  }
  if (params.recovery.recoveryReasonCode === "recovery_exhausted") {
    return true;
  }
  const reason = params.recoveryReason ?? params.recovery.recoveryReasonCode;
  if (reason && FAILOVER_ON_ZERO_WRITABLE_REASONS.has(reason)) {
    return true;
  }
  if ((params.recovery.recoveryAttemptCount ?? 0) >= 1) {
    return true;
  }
  return false;
};
