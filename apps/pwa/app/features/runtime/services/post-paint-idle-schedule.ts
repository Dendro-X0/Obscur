import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";

/** Default wait after first paint before idle-gated unlock work (N2a/N2b / E23). */
export const POST_PAINT_IDLE_DELAY_MS = 500;

/** Max wait for idle callback before running deferred unlock work. */
export const POST_PAINT_IDLE_TIMEOUT_MS = 2_000;

export type SchedulePostPaintIdleOptions = Readonly<{
  postPaintDelayMs?: number;
  idleTimeoutMs?: number;
  scheduleAfterPaint?: (callback: () => void) => () => void;
  scheduleDelay?: (callback: () => void, delayMs: number) => () => void;
  scheduleIdle?: (work: () => void, timeoutMs: number) => () => void;
}>;

const defaultScheduleAfterPaint = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return () => undefined;
  }
  if (typeof window.requestAnimationFrame === "function") {
    const frameId = window.requestAnimationFrame(() => {
      callback();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }
  const timerId = window.setTimeout(callback, 0);
  return () => {
    window.clearTimeout(timerId);
  };
};

const defaultScheduleDelay = (callback: () => void, delayMs: number): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return () => undefined;
  }
  const timerId = window.setTimeout(callback, delayMs);
  return () => {
    window.clearTimeout(timerId);
  };
};

/**
 * Run work after first paint + short delay + idle (P1 before hydrate storm).
 */
export const schedulePostPaintIdleWork = (
  work: () => void,
  options: SchedulePostPaintIdleOptions = {},
): (() => void) => {
  const postPaintDelayMs = options.postPaintDelayMs ?? POST_PAINT_IDLE_DELAY_MS;
  const idleTimeoutMs = options.idleTimeoutMs ?? POST_PAINT_IDLE_TIMEOUT_MS;
  const scheduleAfterPaint = options.scheduleAfterPaint ?? defaultScheduleAfterPaint;
  const scheduleDelay = options.scheduleDelay ?? defaultScheduleDelay;
  const scheduleIdle = options.scheduleIdle ?? scheduleIdleWork;

  let cancelled = false;
  let cancelPaint: (() => void) | null = null;
  let cancelDelay: (() => void) | null = null;
  let cancelIdle: (() => void) | null = null;

  cancelPaint = scheduleAfterPaint(() => {
    if (cancelled) {
      return;
    }
    cancelDelay = scheduleDelay(() => {
      if (cancelled) {
        return;
      }
      cancelIdle = scheduleIdle(() => {
        if (cancelled) {
          return;
        }
        work();
      }, idleTimeoutMs);
    }, postPaintDelayMs);
  });

  return () => {
    cancelled = true;
    cancelPaint?.();
    cancelDelay?.();
    cancelIdle?.();
  };
};
