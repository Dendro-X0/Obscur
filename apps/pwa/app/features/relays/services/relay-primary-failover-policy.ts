import type { RelayRecoveryReasonCode, RelayRecoverySnapshot } from "./relay-recovery-policy";

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
  if (params.recoveryReason === "no_writable_relays") {
    return true;
  }
  if ((params.recovery.recoveryAttemptCount ?? 0) >= 2) {
    return true;
  }
  return false;
};
