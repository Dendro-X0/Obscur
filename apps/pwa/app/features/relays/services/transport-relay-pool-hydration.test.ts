import { describe, expect, it } from "vitest";
import {
  resolveEffectiveDmTransportRelayUrls,
  resolveEnginePoolHydrationRelayUrls,
} from "./transport-relay-pool-hydration";

describe("transport-relay-pool-hydration", () => {
  it("hydrates pool from checkpoint URLs when user and custom relays are empty", () => {
    expect(resolveEnginePoolHydrationRelayUrls({
      userEnabledRelayUrls: [],
      customNodeRelayUrls: [],
      engineConfiguredRelayUrls: ["wss://group.relay", "wss://backup.relay"],
      engineCheckpointRelayUrls: ["wss://checkpoint.relay"],
    })).toEqual(["wss://checkpoint.relay"]);
  });

  it("falls back to configured engine URLs when no checkpoints exist", () => {
    expect(resolveEnginePoolHydrationRelayUrls({
      userEnabledRelayUrls: [],
      customNodeRelayUrls: [],
      engineConfiguredRelayUrls: ["wss://group.relay"],
      engineCheckpointRelayUrls: [],
    })).toEqual(["wss://group.relay"]);
  });

  it("does not hydrate when user relay settings exist", () => {
    expect(resolveEnginePoolHydrationRelayUrls({
      userEnabledRelayUrls: ["wss://relay.one"],
      customNodeRelayUrls: [],
      engineConfiguredRelayUrls: ["wss://group.relay"],
      engineCheckpointRelayUrls: ["wss://checkpoint.relay"],
    })).toEqual([]);
  });

  it("uses effective DM transport URLs with engine hydration fallback", () => {
    expect(resolveEffectiveDmTransportRelayUrls({
      userDmTransportRelayUrls: [],
      enginePoolHydrationRelayUrls: ["wss://checkpoint.relay"],
    })).toEqual(["wss://checkpoint.relay"]);
    expect(resolveEffectiveDmTransportRelayUrls({
      userDmTransportRelayUrls: ["wss://relay.one"],
      enginePoolHydrationRelayUrls: ["wss://checkpoint.relay"],
    })).toEqual(["wss://relay.one"]);
  });
});
