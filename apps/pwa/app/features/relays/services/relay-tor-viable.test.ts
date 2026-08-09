import { describe, expect, it } from "vitest";
import {
  classifyTorRelayEndpoint,
  filterTorViableDmRelayUrls,
  resolveTorViableDmRelayUrls,
  TOR_VIABLE_MAX_DIAL_TARGETS,
} from "./relay-tor-viable";

describe("classifyTorRelayEndpoint", () => {
  it("classifies onion WS / HTTP / public CF / lab", () => {
    expect(classifyTorRelayEndpoint("wss://abcdef.onion")).toBe("onion_ws");
    expect(classifyTorRelayEndpoint("http://abcdef.onion:8788")).toBe("onion_http");
    expect(classifyTorRelayEndpoint("wss://nos.lol")).toBe("public_cf");
    expect(classifyTorRelayEndpoint("wss://relay.damus.io")).toBe("public_cf");
    expect(classifyTorRelayEndpoint("ws://localhost:7000")).toBe("lab_loopback");
    expect(classifyTorRelayEndpoint("wss://custom.example.com")).toBe("other_clear");
  });

  it("honors allowlist hosts", () => {
    const allowlist = new Set(["relay.example.com"]);
    expect(classifyTorRelayEndpoint("wss://relay.example.com", allowlist)).toBe("tor_allowlist");
  });
});

describe("resolveTorViableDmRelayUrls", () => {
  it("subtracts CF publics when only defaults are enabled", () => {
    const urls = resolveTorViableDmRelayUrls([
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.primal.net", enabled: true },
      { url: "wss://relay.damus.io", enabled: true },
    ]);
    expect(urls).toEqual([]);
  });

  it("keeps onion WS and caps dial targets", () => {
    const urls = resolveTorViableDmRelayUrls([
      { url: "wss://aaa.onion", enabled: true },
      { url: "wss://bbb.onion", enabled: true },
      { url: "wss://ccc.onion", enabled: true },
      { url: "wss://nos.lol", enabled: true },
    ]);
    expect(urls).toEqual(["wss://aaa.onion", "wss://bbb.onion"]);
    expect(urls.length).toBeLessThanOrEqual(TOR_VIABLE_MAX_DIAL_TARGETS);
  });

  it("excludes onion HTTP from NativeRelay pool", () => {
    const urls = resolveTorViableDmRelayUrls([
      { url: "http://mesh.onion:8788", enabled: true },
      { url: "wss://nos.lol", enabled: true },
    ]);
    expect(urls).toEqual([]);
  });

  it("uses lab loopback when DM pool is lab-only (no CF remotes in DM resolve)", () => {
    const urls = resolveTorViableDmRelayUrls([
      { url: "ws://localhost:7000", enabled: true },
    ]);
    expect(urls).toEqual(["ws://localhost:7000"]);
  });

  it("does not fall back to lab while CF publics are enabled (empty Tor remotes)", () => {
    // Lab escape hatch only when onion/allowlist set is empty — CF alone stays empty.
    const urls = resolveTorViableDmRelayUrls([
      { url: "wss://nos.lol", enabled: true },
    ]);
    expect(urls).toEqual([]);
  });

  it("prefers onion over lab when both enabled", () => {
    const urls = resolveTorViableDmRelayUrls([
      { url: "ws://localhost:7000", enabled: true },
      { url: "wss://relay.onion", enabled: true },
    ]);
    expect(urls).toEqual(["wss://relay.onion"]);
  });
});

describe("filterTorViableDmRelayUrls", () => {
  it("filters a resolved clearnet DM list", () => {
    expect(filterTorViableDmRelayUrls([
      "wss://nos.lol",
      "wss://relay.damus.io",
      "wss://xyz.onion",
    ])).toEqual(["wss://xyz.onion"]);
  });
});
