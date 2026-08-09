import { describe, expect, it } from "vitest";

import {
  STALE_TOR_WS_CLEARNET_NOTE,
  TOR_GATEWAY_OWNERSHIP_NOTE_DEFAULT,
  TOR_LIFECYCLE_UX_DEFAULTS,
  dialPhaseToLifecycleUxPhase,
  getTorLifecycleUxDefaultCopy,
  resolveTorLifecycleUxPhase,
  torLifecycleUxI18nKey,
} from "./tor-lifecycle-ux";

describe("tor-lifecycle-ux (TI-3)", () => {
  it("maps dial phases to UX phases", () => {
    expect(dialPhaseToLifecycleUxPhase("clearnet")).toBe("off");
    expect(dialPhaseToLifecycleUxPhase("warming")).toBe("warming");
    expect(dialPhaseToLifecycleUxPhase("tor_armed")).toBe("ready");
    expect(dialPhaseToLifecycleUxPhase("degraded")).toBe("degraded");
  });

  it("resolves Warming / Ready / Degraded from dial snapshot", () => {
    expect(resolveTorLifecycleUxPhase({
      preferenceOn: true,
      lifecycleReady: false,
      gatewayReachable: false,
      everReadyWhilePreferred: false,
      startFailed: false,
    })).toBe("warming");

    expect(resolveTorLifecycleUxPhase({
      preferenceOn: true,
      lifecycleReady: true,
      gatewayReachable: true,
      everReadyWhilePreferred: true,
      startFailed: false,
    })).toBe("ready");

    expect(resolveTorLifecycleUxPhase({
      preferenceOn: true,
      lifecycleReady: false,
      gatewayReachable: false,
      everReadyWhilePreferred: true,
      startFailed: false,
    })).toBe("degraded");
  });

  it("ships TI-0 honesty copy and subtracts stale WS note", () => {
    expect(TOR_LIFECYCLE_UX_DEFAULTS.warming).toContain("clearnet relays still in use");
    expect(TOR_LIFECYCLE_UX_DEFAULTS.ready).toContain("Tor-viable");
    expect(TOR_LIFECYCLE_UX_DEFAULTS.degraded).toContain("temporarily using clearnet");
    expect(TOR_GATEWAY_OWNERSHIP_NOTE_DEFAULT).not.toContain(STALE_TOR_WS_CLEARNET_NOTE);
    expect(getTorLifecycleUxDefaultCopy("off")).toBeNull();
    expect(torLifecycleUxI18nKey("warming")).toBe("settings.security.tor.phase.warming");
  });

  it("uses bootstrap-failed copy when gateway is up but start failed", () => {
    expect(getTorLifecycleUxDefaultCopy("degraded", {
      gatewayReachable: true,
      startFailed: true,
    })).toContain("failed to start or bootstrap");
  });
});
