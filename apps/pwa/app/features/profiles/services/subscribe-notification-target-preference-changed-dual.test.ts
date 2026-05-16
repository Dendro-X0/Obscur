import { describe, expect, it, vi, afterEach } from "vitest";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { subscribeNotificationTargetPreferenceChangedDual } from "./subscribe-notification-target-preference-changed-dual";

describe("subscribeNotificationTargetPreferenceChangedDual", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes listener when bus publishes", async () => {
    const bus = createProfileMessageBus({ profileId: "p1" });
    const seen: number[] = [];
    const unsub = subscribeNotificationTargetPreferenceChangedDual(() => {
      seen.push(Date.now());
    }, bus);

    bus.publish({ type: "notification-target-preference-changed" });

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });
    expect(seen).toHaveLength(1);

    unsub();
  });

  it("unsubscribes bus handler", () => {
    const bus = createProfileMessageBus({ profileId: "p1" });
    let n = 0;
    const unsub = subscribeNotificationTargetPreferenceChangedDual(() => {
      n += 1;
    }, bus);
    unsub();
    bus.publish({ type: "notification-target-preference-changed" });
    expect(n).toBe(0);
  });
});
