import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getNowMsServerSnapshot,
    getNowMsSnapshot,
    nowMsInternalsForTests,
    subscribeNowMs,
} from "./time";

describe("messaging time clock ownership", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        nowMsInternalsForTests.reset();
    });

    afterEach(() => {
        nowMsInternalsForTests.reset();
        vi.useRealTimers();
    });

    it("starts interval and seeds snapshot on first listener", () => {
        expect(getNowMsSnapshot()).toBeNull();
        expect(nowMsInternalsForTests.getState().hasInterval).toBe(false);

        const unsubscribe = subscribeNowMs(() => undefined);

        const state = nowMsInternalsForTests.getState();
        expect(state.listenerCount).toBe(1);
        expect(state.hasInterval).toBe(true);
        expect(typeof state.snapshot).toBe("number");

        unsubscribe();
    });

    it("notifies newly subscribed listeners on microtask tick", async () => {
        const listener = vi.fn();
        const unsubscribe = subscribeNowMs(listener);

        expect(listener).toHaveBeenCalledTimes(0);
        await Promise.resolve();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
    });

    it("ticks subscribers and stops interval when unused", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeNowMs(listener);

        vi.advanceTimersByTime(30_000);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(typeof getNowMsSnapshot()).toBe("number");

        unsubscribe();

        const state = nowMsInternalsForTests.getState();
        expect(state.listenerCount).toBe(0);
        expect(state.hasInterval).toBe(false);
        expect(state.snapshot).toBeNull();
    });

    it("keeps server snapshot deterministic null", () => {
        expect(getNowMsServerSnapshot()).toBeNull();
    });
});
