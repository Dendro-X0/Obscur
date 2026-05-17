import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { scheduleIdleWork } from "./schedule-idle-work";

describe("scheduleIdleWork", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("falls back to setTimeout when requestIdleCallback is unavailable", () => {
        const work = vi.fn();
        const cancel = scheduleIdleWork(work);
        expect(work).not.toHaveBeenCalled();
        vi.advanceTimersByTime(64);
        expect(work).toHaveBeenCalledTimes(1);
        cancel();
    });
});
