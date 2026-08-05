import type { RelayRecoveryReasonCode, RelayRecoverySnapshot } from "./relay-recovery-types";
import type { RelayTransportMode } from "./relay-transport-mode";

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
  /** RUST-4a: Rust mesh scheduler owns pad/failover — TS must not dual-own. */
  meshSchedulerOwnsFailover?: boolean;
  /**
   * S2: allow invoking attemptPrimaryFailover while writable>0 (e.g. local lab open).
   * Caller no-ops unless reconcilePrimarySelection wants a switch.
   */
  allowWithWritableRelays?: boolean;
  /**
   * D2: Single-node (`basic`) auto-correct — when mesh does not own failover, allow a
   * reconcile probe on instability even if a standby is already writable.
   */
  transportMode?: RelayTransportMode;
}>): boolean => {
  if (params.meshSchedulerOwnsFailover === true) {
    return false;
  }
  if (params.allEnabledRelayCount <= 1) {
    return false;
  }
  if (params.writableRelayCount > 0) {
    if (params.allowWithWritableRelays === true) {
      return true;
    }
    // Single-node: primary label may be dead while a padded standby is writable.
    if (params.transportMode === "basic") {
      if (params.recovery.recoveryReasonCode === "recovery_exhausted") {
        return true;
      }
      const reason = params.recoveryReason ?? params.recovery.recoveryReasonCode;
      if (reason && FAILOVER_ON_ZERO_WRITABLE_REASONS.has(reason)) {
        return true;
      }
    }
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
