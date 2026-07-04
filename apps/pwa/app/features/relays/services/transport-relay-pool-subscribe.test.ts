import { describe, expect, it, vi } from "vitest";
import {
  resolveTransportEnginePoolSubscribeUrls,
  syncTransportEnginePoolSubscriptions,
} from "./transport-relay-pool-subscribe";

describe("transport-relay-pool-subscribe", () => {
  it("resolves checkpoint and engine-only URLs not already in the permanent pool", () => {
    expect(resolveTransportEnginePoolSubscribeUrls({
      permanentPoolUrls: ["wss://relay.one"],
      engineOnlyRelayUrls: ["wss://team.relay"],
      engineCheckpointRelayUrls: ["wss://checkpoint.relay", "wss://relay.one"],
    })).toEqual([
      "wss://checkpoint.relay",
      "wss://team.relay",
    ]);
  });

  it("returns empty when engine URLs are already permanent pool members", () => {
    expect(resolveTransportEnginePoolSubscribeUrls({
      permanentPoolUrls: ["wss://checkpoint.relay"],
      engineOnlyRelayUrls: [],
      engineCheckpointRelayUrls: ["wss://checkpoint.relay"],
    })).toEqual([]);
  });

  it("syncs transient pool subscriptions for resolved URLs", () => {
    const addTransientRelay = vi.fn();
    expect(syncTransportEnginePoolSubscriptions({
      pool: { addTransientRelay },
      subscribeUrls: ["wss://team.relay", "wss://checkpoint.relay"],
    })).toBe(2);
    expect(addTransientRelay).toHaveBeenCalledTimes(2);
    expect(addTransientRelay).toHaveBeenNthCalledWith(1, "wss://team.relay");
    expect(addTransientRelay).toHaveBeenNthCalledWith(2, "wss://checkpoint.relay");
  });
});
