import { describe, expect, it } from "vitest";
import {
  computeRelayQuickAverageLatency,
  formatRelayLatencyHistoryCaption,
  formatRelayLatencyLabel,
} from "./format-relay-latency-label";

describe("formatRelayLatencyLabel", () => {
  it("returns n/a without positive latency", () => {
    expect(formatRelayLatencyLabel(undefined)).toBe("n/a");
    expect(formatRelayLatencyLabel({ latency: 0, latencyHistory: [] })).toBe("n/a");
  });

  it("returns Ready when publish-ready without latency samples", () => {
    expect(formatRelayLatencyLabel(undefined, { publishReady: true })).toBe("n/a");
    expect(formatRelayLatencyLabel(undefined, { socketOpen: true })).toBe("Ready");
    expect(formatRelayLatencyLabel({ latency: 0, latencyHistory: [] }, { socketOpen: true, publishReady: true })).toBe("Ready");
  });

  it("labels connect/handshake samples", () => {
    expect(formatRelayLatencyLabel({
      latency: 17.4,
      latencyHistory: [17],
      latencySampleSource: "connect",
    })).toBe("Connect 17ms");
    expect(formatRelayLatencyLabel({
      latency: 42,
      latencyHistory: [42],
    })).toBe("Connect 42ms");
  });

  it("labels in-pool app RTT samples", () => {
    expect(formatRelayLatencyLabel({
      latency: 48.2,
      latencyHistory: [48],
      latencySampleSource: "app",
    })).toBe("RTT 48ms");
  });

  it("prefixes Last when socket is not open", () => {
    expect(formatRelayLatencyLabel({
      latency: 1371,
      latencyHistory: [1371],
      latencySampleSource: "connect",
    }, { socketOpen: false })).toBe("Last Connect 1371ms");
    expect(formatRelayLatencyLabel({
      latency: 50,
      latencyHistory: [50],
      latencySampleSource: "app",
    }, { socketOpen: false })).toBe("Last RTT 50ms");
    expect(formatRelayLatencyLabel({
      latency: 50,
      latencyHistory: [50],
      latencySampleSource: "app",
    }, { socketOpen: true })).toBe("RTT 50ms");
  });
});

describe("formatRelayLatencyHistoryCaption", () => {
  it("matches last sample source", () => {
    expect(formatRelayLatencyHistoryCaption({
      latency: 20,
      latencyHistory: [20],
      latencySampleSource: "app",
    })).toBe("App RTT");
    expect(formatRelayLatencyHistoryCaption({
      latency: 20,
      latencyHistory: [20],
      latencySampleSource: "connect",
    })).toBe("Connect");
    expect(formatRelayLatencyHistoryCaption({
      latency: 0,
      latencyHistory: [],
    })).toBe("No samples");
  });

  it("uses Last* captions when socket is not open", () => {
    expect(formatRelayLatencyHistoryCaption({
      latency: 20,
      latencyHistory: [20],
      latencySampleSource: "connect",
    }, { socketOpen: false })).toBe("Last Connect");
    expect(formatRelayLatencyHistoryCaption({
      latency: 20,
      latencyHistory: [20],
      latencySampleSource: "app",
    }, { socketOpen: false })).toBe("Last App RTT");
  });
});

describe("computeRelayQuickAverageLatency", () => {
  it("returns none when no open samples", () => {
    expect(computeRelayQuickAverageLatency({
      openEnabledUrls: [],
      metricsByUrl: new Map([["wss://a.example", { latency: 100, latencySampleSource: "connect" }]]),
    })).toEqual({ kind: "none" });
  });

  it("averages open connect samples as Avg Connect", () => {
    expect(computeRelayQuickAverageLatency({
      openEnabledUrls: ["wss://a.example", "wss://b.example"],
      metricsByUrl: new Map([
        ["wss://a.example", { latency: 100, latencySampleSource: "connect" }],
        ["wss://b.example", { latency: 200, latencySampleSource: "connect" }],
        ["wss://closed.example", { latency: 900, latencySampleSource: "connect" }],
      ]),
    })).toEqual({ averageLatencyMs: 150, kind: "connect" });
  });

  it("prefers app RTT samples when any open member has them", () => {
    expect(computeRelayQuickAverageLatency({
      openEnabledUrls: ["wss://a.example", "wss://b.example"],
      metricsByUrl: new Map([
        ["wss://a.example", { latency: 900, latencySampleSource: "connect" }],
        ["wss://b.example", { latency: 50, latencySampleSource: "app" }],
      ]),
    })).toEqual({ averageLatencyMs: 50, kind: "rtt" });
  });

  it("matches localhost aliases for open metrics", () => {
    expect(computeRelayQuickAverageLatency({
      openEnabledUrls: ["ws://127.0.0.1:7000"],
      metricsByUrl: new Map([
        ["ws://localhost:7000", { latency: 12, latencySampleSource: "app" }],
      ]),
    })).toEqual({ averageLatencyMs: 12, kind: "rtt" });
  });
});
