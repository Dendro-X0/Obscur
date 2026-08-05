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

  it("attempts failover on publish_timeouts with zero writable relays", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 2,
      writableRelayCount: 0,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "publish_timeouts",
    })).toBe(true);
  });

  it("attempts failover after the first recovery attempt when still no writable relays", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 2,
      writableRelayCount: 0,
      recovery: { recoveryAttemptCount: 1 },
    })).toBe(true);
  });

  it("skips TS failover when Rust mesh scheduler owns failover (RUST-4a)", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 0,
      recovery: { recoveryReasonCode: "recovery_exhausted", recoveryAttemptCount: 6 },
      meshSchedulerOwnsFailover: true,
    })).toBe(false);
  });

  it("skips failover when writable relays remain without S2 allow flag", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 1,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "no_writable_relays",
    })).toBe(false);
  });

  it("S2: allows failover probe when writable>0 with allowWithWritableRelays", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 1,
      recovery: { recoveryAttemptCount: 0 },
      allowWithWritableRelays: true,
    })).toBe(true);
  });

  it("D2: Single-node allows failover probe when standby writable but primary unstable", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 1,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "no_writable_relays",
      transportMode: "basic",
    })).toBe(true);
  });

  it("D2: Multi-node still requires S2 flag when writable>0", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 1,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "no_writable_relays",
      transportMode: "redundancy",
    })).toBe(false);
  });

  it("D2: mesh ownership still wins over Single-node auto-correct", () => {
    expect(shouldAttemptPrimaryFailover({
      allEnabledRelayCount: 3,
      writableRelayCount: 1,
      recovery: { recoveryAttemptCount: 0 },
      recoveryReason: "publish_timeouts",
      transportMode: "basic",
      meshSchedulerOwnsFailover: true,
    })).toBe(false);
  });
});
