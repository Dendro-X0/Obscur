import { describe, expect, it, beforeEach } from "vitest";
import {
  isDevicePasswordBindPending,
  resetDevicePasswordBindPendingForTests,
  setDevicePasswordBindPending,
  subscribeDevicePasswordBindPending,
} from "./device-password-bind-pending";

describe("device-password-bind-pending", () => {
  beforeEach(() => {
    resetDevicePasswordBindPendingForTests();
  });

  it("notifies subscribers when pending flips", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeDevicePasswordBindPending(() => {
      seen.push(isDevicePasswordBindPending());
    });

    setDevicePasswordBindPending(true);
    setDevicePasswordBindPending(true);
    setDevicePasswordBindPending(false);
    unsubscribe();
    setDevicePasswordBindPending(true);

    expect(seen).toEqual([true, false]);
    expect(isDevicePasswordBindPending()).toBe(true);
  });
});
