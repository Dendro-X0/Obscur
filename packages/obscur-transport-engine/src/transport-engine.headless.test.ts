import { describe, expect, it } from "vitest";
import { createTransportEngine } from "./transport-engine";

describe("transport-engine headless", () => {
  it("owns a single snapshot without WebSocket or React", () => {
    const engine = createTransportEngine({ profileId: "default", windowLabel: "main" });
    expect(engine.getSnapshot().phase).toBe("offline");
    expect(engine.getSnapshot().recovery.readiness).toBe("offline");

    const next = engine.applyAdapterMetrics({
      enabledRelayCount: 1,
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    }, {
      enabledRelayUrls: ["wss://relay.example"],
      activeSubscriptionCount: 1,
    });

    expect(next.phase).toBe("healthy");
    expect(next.recovery.readiness).toBe("healthy");
    expect(next.revision).toBe(1);
    expect(engine.getSnapshot()).toBe(next);
  });

  it("notifies subscribers on metric updates", () => {
    const engine = createTransportEngine({ profileId: "default" });
    let notifyCount = 0;
    const unsubscribe = engine.subscribe(() => {
      notifyCount += 1;
    });

    engine.applyAdapterMetrics({
      enabledRelayCount: 1,
      writableRelayCount: 0,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 0,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    }, { enabledRelayUrls: ["wss://relay.example"] });

    unsubscribe();
    engine.applyAdapterMetrics({
      enabledRelayCount: 1,
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    });

    expect(notifyCount).toBe(1);
  });
});
