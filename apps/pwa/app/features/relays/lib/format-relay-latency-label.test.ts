import { describe, expect, it } from "vitest";
import {
  formatRelayLatencyHistoryCaption,
  formatRelayLatencyLabel,
} from "./format-relay-latency-label";

describe("formatRelayLatencyLabel", () => {
  it("returns n/a without positive latency", () => {
    expect(formatRelayLatencyLabel(undefined)).toBe("n/a");
    expect(formatRelayLatencyLabel({ latency: 0, latencyHistory: [] })).toBe("n/a");
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
});
