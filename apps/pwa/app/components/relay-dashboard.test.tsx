import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelayDashboard, buildOrderedRelayDashboardUrls } from "./relay-dashboard";

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: vi.fn(() => ({
    enabledRelayUrls: ["wss://relay.damus.io"],
    communityCandidateRelayUrls: [],
    activePoolRelayUrls: ["wss://relay.damus.io"],
    relaySelection: {
      primaryUrl: "wss://relay.damus.io",
    },
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

describe("buildOrderedRelayDashboardUrls", () => {
    it("places primary first, then remaining enabled relays, then others sorted", () => {
        const ordered = buildOrderedRelayDashboardUrls({
            metricsKeys: ["wss://z.example", "wss://a.example"],
            enabledRelayUrls: ["wss://b.example", "wss://a.example", "wss://primary.example"],
            connectionUrls: ["wss://orphan.example"],
            fallbackRelayUrls: ["wss://z.example"],
            primaryUrl: "wss://primary.example",
        });
        expect(ordered[0]).toBe("wss://primary.example");
        expect(ordered.slice(1, 4)).toEqual(["wss://b.example", "wss://a.example", "wss://orphan.example"]);
        expect(ordered[4]).toBe("wss://z.example");
    });

    it("omits empty primary string", () => {
        const ordered = buildOrderedRelayDashboardUrls({
            metricsKeys: ["wss://only.example"],
            enabledRelayUrls: [],
            connectionUrls: [],
            fallbackRelayUrls: [],
            primaryUrl: "",
        });
        expect(ordered).toEqual(["wss://only.example"]);
    });
});

describe("RelayDashboard", () => {
  it("renders metrics from the live relay provider health snapshot", () => {
    render(<RelayDashboard />);

    expect(screen.getByText("relay.damus.io")).toBeInTheDocument();
    expect(screen.getByText("Last samples")).toBeInTheDocument();
    expect(screen.getAllByText("Active transport").length).toBeGreaterThan(0);
  });

  it("shows an explicit empty-state message when no latency samples exist yet", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      enabledRelayUrls: ["wss://relay.empty.example"],
      communityCandidateRelayUrls: [],
      activePoolRelayUrls: ["wss://relay.empty.example"],
      relaySelection: {
        primaryUrl: "wss://relay.empty.example",
      },
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

  it("labels an enabled workspace relay as connected when its socket is open", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      enabledRelayUrls: ["wss://relay.damus.io"],
      communityCandidateRelayUrls: ["ws://localhost:7000"],
      activePoolRelayUrls: ["wss://relay.damus.io"],
      relaySelection: {
        primaryUrl: "wss://relay.damus.io",
      },
      relayPool: {
        connections: [
          { url: "wss://relay.damus.io", status: "open", updatedAtUnixMs: 1 },
          { url: "ws://localhost:7000", status: "open", updatedAtUnixMs: 1 },
        ],
        healthMetrics: [
          {
            url: "ws://localhost:7000",
            status: "connected",
            connectionAttempts: 1,
            successfulConnections: 1,
            failedConnections: 0,
            latency: 82,
            latencyHistory: [76, 82],
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

    render(<RelayDashboard category="intranet" />);

    expect(screen.getByText("ws://localhost:7000")).toBeInTheDocument();
    expect(screen.getAllByText("Connected").length).toBeGreaterThan(0);
    expect(screen.queryByText("Disabled")).not.toBeInTheDocument();
  });
});
