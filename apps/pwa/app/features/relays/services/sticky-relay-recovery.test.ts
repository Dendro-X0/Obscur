import { afterEach, describe, expect, it, vi } from "vitest";

import { getAutoRecoveryDelayMs, shouldAutoRecoverRelays } from "./sticky-relay-recovery";

describe("sticky relay recovery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not auto-recover when the browser is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 3,
      writableRelayCount: 0,
    })).toBe(false);
  });

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

    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 3,
      writableRelayCount: 0,
      fallbackWritableRelayCount: 1,
    })).toBe(true);
  });

  it("does not auto-recover when automatic recovery is exhausted", () => {
    expect(shouldAutoRecoverRelays({
      enabledRelayCount: 3,
      writableRelayCount: 0,
      recoveryReasonCode: "recovery_exhausted",
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

  it("slows auto-recovery cadence when fallback writable coverage is active", () => {
    expect(getAutoRecoveryDelayMs({
      readiness: "degraded",
      recoveryAttemptCount: 0,
      fallbackWritableRelayCount: 1,
    })).toBe(12_000);
  });

  it("widens recovery delay budgets when transport is privacy routed", () => {
    expect(getAutoRecoveryDelayMs({
      readiness: "offline",
      recoveryAttemptCount: 0,
      transportRoutingMode: "privacy_routed",
    })).toBe(4_000);

    expect(getAutoRecoveryDelayMs({
      readiness: "recovering",
      recoveryAttemptCount: 3,
      transportRoutingMode: "privacy_routed",
    })).toBe(9_000);

    expect(getAutoRecoveryDelayMs({
      readiness: "degraded",
      recoveryAttemptCount: 0,
      fallbackWritableRelayCount: 1,
      transportRoutingMode: "privacy_routed",
    })).toBe(18_000);
  });
});
