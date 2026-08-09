import { describe, expect, it } from "vitest";
import {
  resolveDmUrlsForTorDialPhase,
  resolveTorDialPolicyPhase,
  shouldUseTorViableDialPool,
  type TorDialPolicySnapshot,
} from "./relay-tor-dial-policy";

const base = (
  overrides: Partial<TorDialPolicySnapshot> = {},
): TorDialPolicySnapshot => ({
  preferenceOn: false,
  lifecycleReady: false,
  gatewayReachable: false,
  everReadyWhilePreferred: false,
  startFailed: false,
  ...overrides,
});

describe("resolveTorDialPolicyPhase", () => {
  it("preference OFF → clearnet", () => {
    expect(resolveTorDialPolicyPhase(base())).toBe("clearnet");
    expect(resolveTorDialPolicyPhase(base({
      preferenceOn: false,
      lifecycleReady: true,
      gatewayReachable: true,
    }))).toBe("clearnet");
  });

  it("preference ON · not Ready → warming (keep clearnet)", () => {
    expect(resolveTorDialPolicyPhase(base({ preferenceOn: true }))).toBe("warming");
    expect(shouldUseTorViableDialPool("warming")).toBe(false);
  });

  it("preference ON · Ready + reachable → tor_armed", () => {
    expect(resolveTorDialPolicyPhase(base({
      preferenceOn: true,
      lifecycleReady: true,
      gatewayReachable: true,
    }))).toBe("tor_armed");
    expect(shouldUseTorViableDialPool("tor_armed")).toBe(true);
  });

  it("Ready without gatewayReachable is not armed", () => {
    expect(resolveTorDialPolicyPhase(base({
      preferenceOn: true,
      lifecycleReady: true,
      gatewayReachable: false,
    }))).toBe("warming");
  });

  it("preference ON · was Ready then lost → degraded (restore clearnet)", () => {
    expect(resolveTorDialPolicyPhase(base({
      preferenceOn: true,
      lifecycleReady: false,
      gatewayReachable: false,
      everReadyWhilePreferred: true,
    }))).toBe("degraded");
    expect(shouldUseTorViableDialPool("degraded")).toBe(false);
  });

  it("preference ON · start failed → degraded", () => {
    expect(resolveTorDialPolicyPhase(base({
      preferenceOn: true,
      startFailed: true,
    }))).toBe("degraded");
  });
});

describe("resolveDmUrlsForTorDialPhase", () => {
  const clearnet = ["wss://nos.lol", "wss://relay.damus.io"];
  const viable = ["wss://abc.onion"];

  it("uses clearnet for warming and degraded", () => {
    expect(resolveDmUrlsForTorDialPhase({
      phase: "warming",
      clearnetUrls: clearnet,
      torViableUrls: viable,
    })).toEqual(clearnet);
    expect(resolveDmUrlsForTorDialPhase({
      phase: "degraded",
      clearnetUrls: clearnet,
      torViableUrls: viable,
    })).toEqual(clearnet);
  });

  it("uses Tor-viable only when tor_armed", () => {
    expect(resolveDmUrlsForTorDialPhase({
      phase: "tor_armed",
      clearnetUrls: clearnet,
      torViableUrls: viable,
    })).toEqual(viable);
  });
});
