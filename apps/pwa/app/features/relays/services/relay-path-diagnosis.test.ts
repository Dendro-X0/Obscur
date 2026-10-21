import { describe, expect, it } from "vitest";
import {
  classifyRelayPathDiagnosis,
  classifyRelayUrlSchemeKind,
  isRelayLoopbackUrl,
  summarizeRelayPoolDiagnosis,
} from "./relay-path-diagnosis";

describe("relay-path-diagnosis (Slice A)", () => {
  it("classifies schemes and loopback hosts", () => {
    expect(classifyRelayUrlSchemeKind("wss://relay.damus.io")).toBe("wss");
    expect(classifyRelayUrlSchemeKind("ws://localhost:7000")).toBe("ws");
    expect(classifyRelayUrlSchemeKind("http://127.0.0.1:8788")).toBe("invalid_scheme");
    expect(isRelayLoopbackUrl("ws://localhost:7000")).toBe(true);
    expect(isRelayLoopbackUrl("wss://relay.damus.io")).toBe(false);
  });

  it("maps disabled / invalid / open / connecting / circuit", () => {
    expect(classifyRelayPathDiagnosis({
      url: "ws://localhost:7000",
      enabled: false,
    }).reason).toBe("disabled");

    expect(classifyRelayPathDiagnosis({
      url: "http://127.0.0.1:8788",
      enabled: true,
    }).reason).toBe("invalid_scheme");

    expect(classifyRelayPathDiagnosis({
      url: "wss://relay.damus.io",
      enabled: true,
      connectionStatus: "open",
    }).reason).toBe("open");

    expect(classifyRelayPathDiagnosis({
      url: "wss://relay.damus.io",
      enabled: true,
      connectionStatus: "connecting",
    }).reason).toBe("connecting");

    expect(classifyRelayPathDiagnosis({
      url: "wss://relay.damus.io",
      enabled: true,
      circuitOpen: true,
    }).reason).toBe("circuit_open");
  });

  it("splits unreachable into loopback vs remote and tls/proxy class", () => {
    expect(classifyRelayPathDiagnosis({
      url: "ws://localhost:7000",
      enabled: true,
      connectionStatus: "error",
    }).reason).toBe("loopback_unreachable");

    expect(classifyRelayPathDiagnosis({
      url: "wss://nos.lol",
      enabled: true,
      connectionStatus: "closed",
    }).reason).toBe("remote_unreachable");

    expect(classifyRelayPathDiagnosis({
      url: "wss://nos.lol",
      enabled: true,
      connectionStatus: "error",
      lastErrorClass: "tls_error",
    }).reason).toBe("tls_or_proxy");
  });

  it("summarizes pool honesty: remotes fail + local disabled", () => {
    const summary = summarizeRelayPoolDiagnosis([
      classifyRelayPathDiagnosis({ url: "ws://localhost:7000", enabled: false }),
      classifyRelayPathDiagnosis({
        url: "wss://nos.lol",
        enabled: true,
        connectionStatus: "error",
      }),
      classifyRelayPathDiagnosis({
        url: "wss://relay.damus.io",
        enabled: true,
        connectionStatus: "closed",
      }),
      classifyRelayPathDiagnosis({
        url: "http://127.0.0.1:8788",
        enabled: true,
      }),
    ]);

    expect(summary.disabledCount).toBe(1);
    expect(summary.loopbackDisabledCount).toBe(1);
    expect(summary.enabledRemoteDisconnectedCount).toBe(2);
    expect(summary.invalidSchemeCount).toBe(1);
    expect(summary.hypothesisCopy).toMatch(/local relay not tried/i);
    expect(summary.bannerSupplement).toMatch(/disabled/i);
    expect(summary.bannerSupplement).toMatch(/invalid URL scheme/i);
  });

  it("suggests Docker check when local enabled but unreachable", () => {
    const summary = summarizeRelayPoolDiagnosis([
      classifyRelayPathDiagnosis({
        url: "ws://localhost:7000",
        enabled: true,
        connectionStatus: "error",
      }),
    ]);
    expect(summary.hypothesisCopy).toMatch(/:7000/i);
  });
});
