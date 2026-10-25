import { describe, expect, it, vi } from "vitest";
import { schedulePostPaintIdleWork } from "./post-paint-idle-schedule";

type CallbackSlot = { current: (() => void) | null };

describe("schedulePostPaintIdleWork", () => {
  it("does not run until paint + delay + idle complete", () => {
    const work = vi.fn();
    const afterPaint: CallbackSlot = { current: null };
    const afterDelay: CallbackSlot = { current: null };
    const afterIdle: CallbackSlot = { current: null };

    const cancel = schedulePostPaintIdleWork(work, {
      scheduleAfterPaint: (callback) => {
        afterPaint.current = callback;
        return () => {
          afterPaint.current = null;
        };
      },
      scheduleDelay: (callback) => {
        afterDelay.current = callback;
        return () => {
          afterDelay.current = null;
        };
      },
      scheduleIdle: (callback, _timeoutMs) => {
        afterIdle.current = callback;
        return () => {
          afterIdle.current = null;
        };
      },
    });

    expect(work).not.toHaveBeenCalled();
    afterPaint.current?.();
    expect(work).not.toHaveBeenCalled();
    afterDelay.current?.();
    expect(work).not.toHaveBeenCalled();
    afterIdle.current?.();
    expect(work).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("cancel before idle prevents work", () => {
    const work = vi.fn();
    const afterPaint: CallbackSlot = { current: null };
    const afterDelay: CallbackSlot = { current: null };
    const afterIdle: CallbackSlot = { current: null };

    const cancel = schedulePostPaintIdleWork(work, {
      scheduleAfterPaint: (callback) => {
        afterPaint.current = callback;
        return () => {
          afterPaint.current = null;
        };
      },
      scheduleDelay: (callback) => {
        afterDelay.current = callback;
        return () => {
          afterDelay.current = null;
        };
      },
      scheduleIdle: (callback, _timeoutMs) => {
        afterIdle.current = callback;
        return () => {
          afterIdle.current = null;
        };
      },
    });

    afterPaint.current?.();
    afterDelay.current?.();
    cancel();
    afterIdle.current?.();
    expect(work).not.toHaveBeenCalled();
  });
});
