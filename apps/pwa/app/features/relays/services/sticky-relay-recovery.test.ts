import { describe, expect, it } from "vitest";

import { getAutoRecoveryDelayMs, shouldAutoRecoverRelays } from "./sticky-relay-recovery";

describe("sticky relay recovery", () => {
  it("auto-recovers only when enabled relays exist but none are writable", () => {
    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 3,
      writableRelayCount: 0,
    })).toBe(true);

    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 0,
      writableRelayCount: 0,
    })).toBe(false);

    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 3,
      writableRelayCount: 1,
    })).toBe(false);
  });

  it("uses shorter recovery delays when relays are fully offline", () => {
    expect(getAutoRecoveryDelayMs({
      readiness: "offline",
      recoveryAttemptCount: 0,
    })).toBe(1200);
  });

  it("backs off slightly while already recovering", () => {
    expect(getAutoRecoveryDelayMs({
      readiness: "recovering",
      recoveryAttemptCount: 1,
    })).toBe(2000);

    expect(getAutoRecoveryDelayMs({
      readiness: "recovering",
      recoveryAttemptCount: 3,
    })).toBe(3500);
  });
});
