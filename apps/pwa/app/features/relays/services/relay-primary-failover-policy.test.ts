import { describe, expect, it } from "vitest";

import { shouldAttemptPrimaryFailover } from "./relay-primary-failover-policy";

describe("relay primary failover policy", () => {
  it("skips failover when only one relay is enabled", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 1,
      writableRelayCount: 0,
      recovery: { recoveryAttemptCount: 3 },
      recoveryReason: "no_writable_relays",
    })).toBe(false);
  });

  it("attempts failover when recovery is exhausted", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 0,
      recovery: { recoveryReasonCode: "recovery_exhausted", recoveryAttemptCount: 6 },
    })).toBe(true);
  });

  it("attempts failover on no_writable_relays recovery", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 2,
      writableRelayCount: 0,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "no_writable_relays",
    })).toBe(true);
  });
});
