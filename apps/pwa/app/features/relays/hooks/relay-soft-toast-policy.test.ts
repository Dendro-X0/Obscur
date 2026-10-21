import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countHealthyRelayConnections,
  shouldSurfaceSoftRelayConnectToast,
} from "./relay-soft-toast-policy";
import { relayHealthMonitor } from "./relay-health-monitor";

describe("relay-soft-toast-policy", () => {
  beforeEach(() => {
    relayHealthMonitor.clearAllMetrics();
  });

  afterEach(() => {
    relayHealthMonitor.clearAllMetrics();
  });
  it("counts connected relays from health monitor metrics", () => {
    relayHealthMonitor.recordConnectionSuccess("wss://relay-a.example");
    relayHealthMonitor.recordConnectionFailure("wss://relay-b.example", "offline");
    relayHealthMonitor.recordConnectionSuccess("wss://relay-c.example");

    expect(countHealthyRelayConnections()).toBe(2);
  });

  it("suppresses soft connect toast when at least one relay is connected", () => {
    expect(shouldSurfaceSoftRelayConnectToast({ connectedRelayCount: 1 })).toBe(false);
    expect(shouldSurfaceSoftRelayConnectToast({ connectedRelayCount: 2 })).toBe(false);
  });

  it("surfaces soft connect toast only when the pool has no connected relays", () => {
    expect(shouldSurfaceSoftRelayConnectToast({ connectedRelayCount: 0 })).toBe(true);
  });
});
