import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

import {
  hasSecondaryProfileWindowRefreshDone,
  scheduleSecondaryProfileWindowRefresh,
} from "./secondary-profile-window-reload-scheduler";

describe("scheduleSecondaryProfileWindowRefresh", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("schedules in-process refresh for secondary profile windows only once per reason", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline);
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    const onRefresh = vi.fn();

    expect(scheduleSecondaryProfileWindowRefresh({
      reason: "dm_incoming_only",
      profileId: "profile-2",
      delayMs: 100,
      onRefresh,
    })).toBe(true);

    expect(scheduleSecondaryProfileWindowRefresh({
      reason: "dm_incoming_only",
      profileId: "profile-2",
      delayMs: 100,
      onRefresh,
    })).toBe(true);

    vi.advanceTimersByTime(100);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(hasSecondaryProfileWindowRefreshDone("dm_incoming_only", "profile-2")).toBe(true);

    expect(scheduleSecondaryProfileWindowRefresh({
      reason: "dm_incoming_only",
      profileId: "profile-2",
      delayMs: 100,
      onRefresh,
    })).toBe(false);

    vi.useRealTimers();
  });

  it("skips default profile window", () => {
    expect(scheduleSecondaryProfileWindowRefresh({
      reason: "post_login",
      profileId: "default",
      delayMs: 100,
      onRefresh: vi.fn(),
    })).toBe(false);
  });
});
