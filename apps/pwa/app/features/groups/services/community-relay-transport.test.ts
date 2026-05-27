import { describe, expect, it } from "vitest";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";

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
});
