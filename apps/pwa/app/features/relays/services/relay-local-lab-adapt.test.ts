import { describe, expect, it } from "vitest";

import {
  filterDemotedLocalLabUrls,
  isOperatorRetainedLocalLabUrl,
  shouldAvoidLocalLabAsPrimary,
  shouldDemoteLocalLabFromActivePool,
} from "./relay-local-lab-adapt";

describe("relay-local-lab-adapt (Nostr-first silo)", () => {
  const local = "ws://localhost:7000";

  it("does not demote when remotes are disabled (Soft L3-only)", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      remotesEnabled: false,
    })).toBe(false);
  });

  it("always demotes local lab when remotes are enabled (even cold / healthy)", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      remotesEnabled: true,
    })).toBe(true);
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      hint: { url: local, isOpen: true, isWritable: true, latencyMs: 12 },
      remotesEnabled: true,
    })).toBe(true);
  });

  it("does not demote public URLs", () => {
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: "wss://nos.lol",
      remotesEnabled: true,
    })).toBe(false);
  });

  it("filters localhost from ordered URLs when remotes enabled", () => {
    const filtered = filterDemotedLocalLabUrls({
      orderedEnabledUrls: [local, "wss://nos.lol"],
      remotesEnabled: true,
    });
    expect(filtered).toEqual(["wss://nos.lol"]);
  });

  it("demotes loopback HTTP mesh when remotes are enabled", () => {
    const mesh = "http://127.0.0.1:8788";
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: mesh,
      remotesEnabled: true,
    })).toBe(true);
    expect(filterDemotedLocalLabUrls({
      orderedEnabledUrls: ["wss://nos.lol", mesh, "wss://relay.primal.net"],
      remotesEnabled: true,
    })).toEqual(["wss://nos.lol", "wss://relay.primal.net"]);
  });

  it("keeps localhost when Soft L3-only", () => {
    const filtered = filterDemotedLocalLabUrls({
      orderedEnabledUrls: [local],
      remotesEnabled: false,
    });
    expect(filtered).toEqual([local]);
  });

  it("Self T1: retains matching operator workspace lab in dial set with remotes", () => {
    expect(isOperatorRetainedLocalLabUrl(local, "ws://127.0.0.1:7000")).toBe(true);
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: local,
      remotesEnabled: true,
      retainLabUrl: "ws://localhost:7000",
    })).toBe(false);
    expect(filterDemotedLocalLabUrls({
      orderedEnabledUrls: [local, "wss://nos.lol"],
      remotesEnabled: true,
      retainLabUrl: local,
    })).toEqual([local, "wss://nos.lol"]);
  });

  it("Self T1: mesh HTTP is never retainable", () => {
    const mesh = "http://127.0.0.1:8788";
    expect(isOperatorRetainedLocalLabUrl(mesh, mesh)).toBe(false);
    expect(shouldDemoteLocalLabFromActivePool({
      localUrl: mesh,
      remotesEnabled: true,
      retainLabUrl: mesh,
    })).toBe(true);
  });

  it("Self T1: primary still avoids lab when remotes enabled", () => {
    expect(shouldAvoidLocalLabAsPrimary({
      localUrl: local,
      remotesEnabled: true,
    })).toBe(true);
    expect(shouldAvoidLocalLabAsPrimary({
      localUrl: local,
      remotesEnabled: false,
    })).toBe(false);
  });
});
