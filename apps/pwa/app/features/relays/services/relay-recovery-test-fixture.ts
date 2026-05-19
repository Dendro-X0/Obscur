import type { RelayRecoverySnapshot } from "./relay-recovery-policy";

export const createRelayRecoveryTestSnapshot = (
  overrides: Partial<RelayRecoverySnapshot> = {},
): RelayRecoverySnapshot => ({
  readiness: "healthy",
  writableRelayCount: 1,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 1,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
  ...overrides,
});
