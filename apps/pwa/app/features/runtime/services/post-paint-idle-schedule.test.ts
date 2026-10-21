import { describe, expect, it, vi } from "vitest";
import { schedulePostPaintIdleWork } from "./post-paint-idle-schedule";

describe("schedulePostPaintIdleWork", () => {
  it("does not run until paint + delay + idle complete", () => {
    const work = vi.fn();
    let afterPaint: (() => void) | null = null;
    let afterDelay: (() => void) | null = null;
    let afterIdle: (() => void) | null = null;

    const cancel = schedulePostPaintIdleWork(work, {
      scheduleAfterPaint: (callback) => {
        afterPaint = callback;
        return () => {
          afterPaint = null;
        };
      },
      scheduleDelay: (callback) => {
        afterDelay = callback;
        return () => {
          afterDelay = null;
        };
      },
      scheduleIdle: (callback) => {
        afterIdle = callback;
        return () => {
          afterIdle = null;
        };
      },
    });

    expect(work).not.toHaveBeenCalled();
    afterPaint?.();
    expect(work).not.toHaveBeenCalled();
    afterDelay?.();
    expect(work).not.toHaveBeenCalled();
    afterIdle?.();
    expect(work).toHaveBeenCalledTimes(1);

    cancel();
  });

  it("cancel before idle prevents work", () => {
    const work = vi.fn();
    let afterPaint: (() => void) | null = null;
    let afterDelay: (() => void) | null = null;
    let afterIdle: (() => void) | null = null;

    const cancel = schedulePostPaintIdleWork(work, {
      scheduleAfterPaint: (callback) => {
        afterPaint = callback;
        return () => {
          afterPaint = null;
        };
      },
      scheduleDelay: (callback) => {
        afterDelay = callback;
        return () => {
          afterDelay = null;
        };
      },
      scheduleIdle: (callback) => {
        afterIdle = callback;
        return () => {
          afterIdle = null;
        };
      },
    });

    afterPaint?.();
    afterDelay?.();
    cancel();
    afterIdle?.();
    expect(work).not.toHaveBeenCalled();
  });
});
