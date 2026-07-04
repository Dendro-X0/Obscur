import { describe, expect, it } from "vitest";
import {
  hasWritableCommunityRelayTransport,
  isCommunityRelayPoolWritable,
} from "./community-relay-transport";

describe("hasWritableCommunityRelayTransport", () => {
  it("rejects host-only intranet labels", () => {
    expect(hasWritableCommunityRelayTransport("127.0.0.1")).toBe(false);
    expect(hasWritableCommunityRelayTransport("relay.internal")).toBe(false);
    expect(hasWritableCommunityRelayTransport("wss://relay.internal")).toBe(false);
    expect(hasWritableCommunityRelayTransport("wss://127.0.0.1")).toBe(false);
    expect(hasWritableCommunityRelayTransport("wss://localhost")).toBe(false);
  });

  it("accepts wss relay URLs with explicit local relay port", () => {
    expect(hasWritableCommunityRelayTransport("wss://127.0.0.1:7777")).toBe(true);
    expect(hasWritableCommunityRelayTransport("wss://relay.example.com")).toBe(true);
  });

  it("rejects loopback without a dedicated relay port", () => {
    expect(hasWritableCommunityRelayTransport("wss://127.0.0.1:8787")).toBe(false);
  });

  it("accepts local dev relay port on loopback", () => {
    expect(hasWritableCommunityRelayTransport("ws://localhost:7000")).toBe(true);
    expect(hasWritableCommunityRelayTransport("ws://127.0.0.1:7000")).toBe(true);
  });

  it("isCommunityRelayPoolWritable matches pool writable snapshot", () => {
    const pool = {
      getWritableRelaySnapshot: () => ({
        writableRelayUrls: ["ws://127.0.0.1:7000"],
      }),
    };
    expect(isCommunityRelayPoolWritable("ws://localhost:7000", pool)).toBe(true);
    expect(isCommunityRelayPoolWritable("ws://localhost:7000", {
      getWritableRelaySnapshot: () => ({ writableRelayUrls: [] }),
    })).toBe(false);
  });
});
