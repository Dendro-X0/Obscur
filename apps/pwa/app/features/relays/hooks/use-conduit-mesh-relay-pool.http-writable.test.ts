import { describe, expect, it } from "vitest";

import {
  isHttpMeshPoolUrl,
  resolveLastSuccessfulPublishAtUnixMs,
  shouldAcceptMeshTransientRelayUrl,
} from "./use-conduit-mesh-relay-pool";

describe("isHttpMeshPoolUrl", () => {
  it("accepts loopback mesh HTTP gateways", () => {
    expect(isHttpMeshPoolUrl("http://127.0.0.1:8788")).toBe(true);
    expect(isHttpMeshPoolUrl("https://localhost:8788")).toBe(true);
  });

  it("rejects websocket URLs", () => {
    expect(isHttpMeshPoolUrl("wss://nos.lol")).toBe(false);
    expect(isHttpMeshPoolUrl("ws://localhost:7000")).toBe(false);
  });
});

describe("shouldAcceptMeshTransientRelayUrl (H6b)", () => {
  it("rejects public remotes when Soft L3 exclusive", () => {
    expect(shouldAcceptMeshTransientRelayUrl({
      poolUrls: ["ws://localhost:7000"],
      candidateUrl: "wss://nos.lol",
    })).toBe(false);
  });

  it("allows Soft L3 local when Soft L3 exclusive", () => {
    expect(shouldAcceptMeshTransientRelayUrl({
      poolUrls: ["ws://localhost:7000"],
      candidateUrl: "ws://127.0.0.1:7000",
    })).toBe(true);
  });

  it("rejects public remotes when HTTP-only mesh", () => {
    expect(shouldAcceptMeshTransientRelayUrl({
      poolUrls: ["http://127.0.0.1:8788"],
      candidateUrl: "wss://nos.lol",
    })).toBe(false);
  });

  it("allows public remotes on hybrid pools", () => {
    expect(shouldAcceptMeshTransientRelayUrl({
      poolUrls: ["ws://localhost:7000", "wss://nos.lol"],
      candidateUrl: "wss://relay.damus.io",
    })).toBe(true);
  });
});

describe("resolveLastSuccessfulPublishAtUnixMs", () => {
  it("prefers synchronous stamp over activity snapshot", () => {
    expect(resolveLastSuccessfulPublishAtUnixMs({
      stampedAtUnixMs: 100,
      activityLastSuccessfulPublishAtUnixMs: 50,
    })).toBe(100);
  });

  it("falls back to activity when stamp missing", () => {
    expect(resolveLastSuccessfulPublishAtUnixMs({
      activityLastSuccessfulPublishAtUnixMs: 50,
    })).toBe(50);
  });

  it("returns undefined when neither is set", () => {
    expect(resolveLastSuccessfulPublishAtUnixMs({})).toBeUndefined();
  });
});
