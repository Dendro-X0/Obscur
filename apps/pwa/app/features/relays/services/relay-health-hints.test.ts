import { describe, expect, it } from "vitest";

import { buildRelayHealthHints } from "./relay-health-hints";

describe("buildRelayHealthHints", () => {
  it("marks pool-open relays as open", () => {
    const hints = buildRelayHealthHints(
      ["wss://relay.damus.io"],
      {
        connections: [{ url: "wss://relay.damus.io", status: "open", updatedAtUnixMs: 0 }],
        getRelayHealth: () => undefined,
      },
    );
    expect(hints[0]?.isOpen).toBe(true);
  });

  it("marks probed standbys as open when latency samples exist", () => {
    const hints = buildRelayHealthHints(
      ["wss://nos.lol"],
      {
        connections: [],
        getRelayHealth: () => ({
          url: "wss://nos.lol",
          status: "disconnected",
          connectionAttempts: 1,
          successfulConnections: 0,
          failedConnections: 0,
          latency: 320,
          latencyHistory: [320],
          successRate: 100,
          circuitBreakerState: "closed",
          circuitBreakerFailureCount: 0,
          retryCount: 0,
          backoffDelay: 1000,
        }),
      },
    );
    expect(hints[0]?.isOpen).toBe(true);
  });
});
