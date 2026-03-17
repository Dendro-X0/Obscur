import { beforeEach, describe, expect, it } from "vitest";
import { relayListInternals } from "./use-relay-list";

describe("use-relay-list internals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("allows trusted wss URLs and explicit ws://localhost exception", () => {
    expect(relayListInternals.toTrustedRelayUrl("wss://relay.example/")).toBe("wss://relay.example");
    expect(relayListInternals.toTrustedRelayUrl("ws://localhost:7001")).toBe("ws://localhost:7001");
    expect(relayListInternals.toTrustedRelayUrl("ws://127.0.0.1:7001")).toBeNull();
    expect(relayListInternals.toTrustedRelayUrl("http://relay.example")).toBeNull();
  });

  it("sanitizes relay lists by dropping invalid entries and deduping normalized URLs", () => {
    const sanitized = relayListInternals.sanitizeRelayList([
      { url: "wss://relay.one/", enabled: true },
      { url: "wss://relay.one", enabled: false },
      { url: "ws://localhost:7001", enabled: true },
      { url: "ws://127.0.0.1:7001", enabled: true },
      { url: "http://bad.example", enabled: true },
    ]);

    expect(sanitized).toEqual([
      { url: "wss://relay.one", enabled: true },
      { url: "ws://localhost:7001", enabled: true },
    ]);
  });

  it("filters untrusted stored relays on load", () => {
    const pubkey = "a".repeat(64) as any;
    const storageKey = relayListInternals.getRelayListStorageKey(pubkey);
    localStorage.setItem(storageKey, JSON.stringify([
      { url: "wss://trusted.example/", enabled: true },
      { url: "ws://localhost:7001", enabled: true },
      { url: "ws://127.0.0.1:7001", enabled: true },
      { url: "javascript:alert(1)", enabled: true },
    ]));

    const loaded = relayListInternals.loadRelayListFromStorage(pubkey);
    expect(loaded).toEqual([
      { url: "wss://trusted.example", enabled: true },
      { url: "ws://localhost:7001", enabled: true },
    ]);
  });
});
