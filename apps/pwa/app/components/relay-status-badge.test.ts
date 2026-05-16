import { describe, expect, it } from "vitest";
import { getRelayStatusBadgePresentation } from "./relay-status-badge";
import type { RelayRecoverySnapshot } from "@/app/features/relays/services/relay-recovery-policy";

const createSnapshot = (overrides: Partial<RelayRecoverySnapshot>): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
  ...overrides,
});

describe("relay-status-badge", () => {
  it("maps healthy snapshot to connected label", () => {
    const presentation = getRelayStatusBadgePresentation(createSnapshot({
      readiness: "healthy",
      writableRelayCount: 2,
      subscribableRelayCount: 2,
    }));
    expect(presentation.label).toBe("Connected");
  });

  it("maps healthy snapshot with primaryUrl to via-hostname detail", () => {
    const presentation = getRelayStatusBadgePresentation(
      createSnapshot({ readiness: "healthy", writableRelayCount: 1, subscribableRelayCount: 1 }),
      "wss://relay.damus.io",
    );
    expect(presentation.label).toBe("Connected");
    expect(presentation.detail).toContain("relay.damus.io");
  });

  it("maps degraded snapshot to degraded label with failure reason", () => {
    const presentation = getRelayStatusBadgePresentation(createSnapshot({
      readiness: "degraded",
      writableRelayCount: 0,
      subscribableRelayCount: 1,
      lastFailureReason: "timeout",
    }));
    expect(presentation.label).toBe("Degraded");
    expect(presentation.detail).toContain("timeout");
  });

  it("maps recovering+no_writable_relays to switching relay label", () => {
    const presentation = getRelayStatusBadgePresentation(createSnapshot({
      readiness: "recovering",
      recoveryReasonCode: "no_writable_relays",
      recoveryAttemptCount: 2,
    }));
    expect(presentation.label).toBe("Switching relay");
  });

  it("maps recovering+other reason to retrying label", () => {
    const presentation = getRelayStatusBadgePresentation(createSnapshot({
      readiness: "recovering",
      recoveryReasonCode: "stale_subscriptions",
      currentAction: "resubscribe",
      recoveryAttemptCount: 2,
    }));
    expect(presentation.label).toBe("Retrying");
    expect(presentation.detail).toContain("resubscribe");
  });

  it("maps offline snapshot to offline label", () => {
    const presentation = getRelayStatusBadgePresentation(createSnapshot({
      readiness: "offline",
      lastFailureReason: "socket closed",
    }));
    expect(presentation.label).toBe("Offline");
    expect(presentation.detail).toContain("socket closed");
  });
});
