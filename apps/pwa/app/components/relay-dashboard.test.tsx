import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelayDashboard } from "./relay-dashboard";

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: vi.fn(() => ({
    enabledRelayUrls: ["wss://relay.damus.io"],
    relayPool: {
      connections: [
        { url: "wss://relay.damus.io", status: "open", updatedAtUnixMs: 1 },
      ],
      healthMetrics: [
        {
          url: "wss://relay.damus.io",
          status: "connected",
          connectionAttempts: 2,
          successfulConnections: 2,
          failedConnections: 0,
          latency: 150,
          latencyHistory: [120, 180],
          successRate: 100,
          circuitBreakerState: "closed",
          circuitBreakerFailureCount: 0,
          retryCount: 0,
          backoffDelay: 1000,
        },
      ],
    },
    relayRuntime: {
      phase: "healthy",
      lastInboundEventAtUnixMs: Date.now(),
      fallbackRelayUrls: [],
    },
  })),
}));

describe("RelayDashboard", () => {
  it("renders metrics from the live relay provider health snapshot", () => {
    render(<RelayDashboard />);

    expect(screen.getByText("relay.damus.io")).toBeInTheDocument();
    expect(screen.getByText("Last samples")).toBeInTheDocument();
    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
  });

  it("shows an explicit empty-state message when no latency samples exist yet", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      enabledRelayUrls: ["wss://relay.empty.example"],
      relayPool: {
        connections: [
          { url: "wss://relay.empty.example", status: "open", updatedAtUnixMs: 1 },
        ],
        healthMetrics: [
          {
            url: "wss://relay.empty.example",
            status: "connected",
            connectionAttempts: 1,
            successfulConnections: 1,
            failedConnections: 0,
            latency: 0,
            latencyHistory: [],
            successRate: 100,
            circuitBreakerState: "closed",
            circuitBreakerFailureCount: 0,
            retryCount: 0,
            backoffDelay: 1000,
          },
        ],
      },
      relayRuntime: {
        phase: "healthy",
        lastInboundEventAtUnixMs: Date.now(),
        fallbackRelayUrls: [],
      },
    } as any);

    render(<RelayDashboard />);

    expect(screen.getByText("No latency samples yet")).toBeInTheDocument();
  });
});
