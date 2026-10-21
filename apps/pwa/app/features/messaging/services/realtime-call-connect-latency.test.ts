import { describe, expect, it } from "vitest";
import {
  buildRealtimeCallHostConnectedContext,
  resolveRealtimeCallConnectedElapsedMs,
} from "./realtime-call-connect-latency";

describe("realtime-call-connect-latency", () => {
  it("returns null for missing or invalid start marks", () => {
    expect(resolveRealtimeCallConnectedElapsedMs(null, 1_000)).toBeNull();
    expect(resolveRealtimeCallConnectedElapsedMs(undefined, 1_000)).toBeNull();
    expect(resolveRealtimeCallConnectedElapsedMs(0, 1_000)).toBeNull();
    expect(resolveRealtimeCallConnectedElapsedMs(Number.NaN, 1_000)).toBeNull();
    expect(resolveRealtimeCallConnectedElapsedMs(500, Number.NaN)).toBeNull();
  });

  it("floors non-negative elapsed ms", () => {
    expect(resolveRealtimeCallConnectedElapsedMs(1_000, 1_250.9)).toBe(250);
    expect(resolveRealtimeCallConnectedElapsedMs(2_000, 1_500)).toBe(0);
  });

  it("builds host_connected context with dial and offer legs", () => {
    expect(buildRealtimeCallHostConnectedContext({
      roomIdHint: "room-a",
      peerPubkeySuffix: "abcdef12",
      dialStartedAtUnixMs: 1_000,
      offerSentAtUnixMs: 4_000,
      connectedAtUnixMs: 5_500,
    })).toEqual({
      roomIdHint: "room-a",
      peerPubkeySuffix: "abcdef12",
      dialToConnectedElapsedMs: 4_500,
      offerToConnectedElapsedMs: 1_500,
    });
  });
});
