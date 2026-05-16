import { describe, expect, it, vi, afterEach } from "vitest";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { subscribeVoiceCallOverlayActionDual } from "./subscribe-voice-call-overlay-action-dual";

describe("subscribeVoiceCallOverlayActionDual", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delivers payload from profile bus", async () => {
    const bus = createProfileMessageBus({ profileId: "p1" });
    const payloads: unknown[] = [];
    const unsub = subscribeVoiceCallOverlayActionDual((p) => {
      payloads.push(p);
    }, bus);

    const detail = { action: "accept" as const };
    bus.publish({ type: "voice-call-overlay-action", detail });

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual(detail);

    unsub();
  });

  it("unsubscribes bus handler", () => {
    const bus = createProfileMessageBus({ profileId: "p1" });
    let n = 0;
    const unsub = subscribeVoiceCallOverlayActionDual(() => {
      n += 1;
    }, bus);
    unsub();
    bus.publish({ type: "voice-call-overlay-action", detail: { action: "dismiss" } });
    expect(n).toBe(0);
  });
});
