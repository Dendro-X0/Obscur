import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelayDashboard, buildOrderedRelayDashboardUrls } from "./relay-dashboard";

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: vi.fn(() => ({
    enabledRelayUrls: ["wss://relay.damus.io"],
    communityCandidateRelayUrls: [],
    activePoolRelayUrls: ["wss://relay.damus.io"],
    relayList: {
      state: {
        relays: [{ url: "wss://relay.damus.io", enabled: true }],
      },
    },
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
      engineConfiguredRelayUrls: [],
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

    it("dedupes localhost aliases into one card url", () => {
        const ordered = buildOrderedRelayDashboardUrls({
            metricsKeys: ["ws://127.0.0.1:7000"],
            enabledRelayUrls: ["ws://localhost:7000"],
            connectionUrls: ["ws://127.0.0.1:7000"],
            fallbackRelayUrls: [],
            primaryUrl: "ws://localhost:7000",
        });
        expect(ordered).toEqual(["ws://localhost:7000"]);
    });
});

describe("RelayDashboard", () => {
  it("renders metrics from the live relay provider health snapshot", () => {
    render(<RelayDashboard />);

    expect(screen.getByText("relay.damus.io")).toBeInTheDocument();
    expect(screen.getByText("Connect 150ms")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getAllByText("Active transport").length).toBeGreaterThan(0);
  });

  it("labels app RTT when latencySampleSource is app", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
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
            latency: 48,
            latencyHistory: [48],
            latencySampleSource: "app",
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

    expect(screen.getByText("RTT 48ms")).toBeInTheDocument();
    expect(screen.getByText("App RTT")).toBeInTheDocument();
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

  it("matches pool connection aliases so primary is not falsely Disconnected", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      enabledRelayUrls: ["ws://localhost:7000"],
      communityCandidateRelayUrls: [],
      activePoolRelayUrls: ["ws://127.0.0.1:7000"],
      relaySelection: {
        primaryUrl: "ws://localhost:7000",
      },
      relayPool: {
        connections: [
          { url: "ws://127.0.0.1:7000", status: "open", updatedAtUnixMs: 1 },
        ],
        healthMetrics: [
          {
            url: "ws://127.0.0.1:7000",
            status: "connected",
            connectionAttempts: 1,
            successfulConnections: 1,
            failedConnections: 0,
            latency: 9,
            latencyHistory: [9],
            latencySampleSource: "app",
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

    expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();
    expect(screen.getAllByText("Active transport").length).toBeGreaterThan(0);
    expect(screen.getAllByText("RTT 9ms").length).toBeGreaterThan(0);
    expect(screen.queryByText("ws://127.0.0.1:7000")).not.toBeInTheDocument();
  });

  it("labels historical Connect on a disconnected primary card", async () => {
    const { useRelay } = await import("@/app/features/relays/providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      enabledRelayUrls: ["wss://nos.lol", "wss://relay.primal.net"],
      communityCandidateRelayUrls: [],
      activePoolRelayUrls: ["wss://relay.primal.net"],
      relaySelection: {
        primaryUrl: "wss://nos.lol",
      },
      relayPool: {
        connections: [
          { url: "wss://relay.primal.net", status: "open", updatedAtUnixMs: 1 },
        ],
        healthMetrics: [
          {
            url: "wss://nos.lol",
            status: "disconnected",
            connectionAttempts: 2,
            successfulConnections: 0,
            failedConnections: 2,
            latency: 1371,
            latencyHistory: [900, 1371],
            latencySampleSource: "connect",
            successRate: 0,
            circuitBreakerState: "closed",
            circuitBreakerFailureCount: 0,
            retryCount: 0,
            backoffDelay: 1000,
          },
          {
            url: "wss://relay.primal.net",
            status: "connected",
            connectionAttempts: 1,
            successfulConnections: 1,
            failedConnections: 0,
            latency: 200,
            latencyHistory: [200],
            latencySampleSource: "app",
            successRate: 100,
            circuitBreakerState: "closed",
            circuitBreakerFailureCount: 0,
            retryCount: 0,
            backoffDelay: 1000,
          },
        ],
      },
      relayRuntime: {
        phase: "degraded",
        lastInboundEventAtUnixMs: Date.now() - 60_000,
        fallbackRelayUrls: [],
      },
    } as any);

    render(<RelayDashboard />);

    expect(screen.getByText("Last Connect 1371ms")).toBeInTheDocument();
    expect(screen.getAllByText("Primary (offline)").length).toBeGreaterThan(0);
    expect(screen.getByText("Selected primary — no open socket yet.")).toBeInTheDocument();
    expect(screen.queryByText("No latency samples yet")).not.toBeInTheDocument();
    // Offline compact + Quiet slim both omit Success Rate chrome
    expect(screen.queryByText("Success Rate")).not.toBeInTheDocument();
    expect(screen.getAllByText("Latency History")).toHaveLength(1);
    expect(screen.getByText("RTT 200ms")).toBeInTheDocument();
    expect(screen.getByText(/window idle/i)).toBeInTheDocument();
  });
});
