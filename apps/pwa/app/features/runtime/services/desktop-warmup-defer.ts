import {
  POST_PAINT_IDLE_DELAY_MS,
  POST_PAINT_IDLE_TIMEOUT_MS,
  schedulePostPaintIdleWork,
  type SchedulePostPaintIdleOptions,
} from "./post-paint-idle-schedule";

/** @deprecated Prefer POST_PAINT_IDLE_DELAY_MS — kept for N2a call sites. */
export const DESKTOP_WARMUP_POST_PAINT_DELAY_MS = POST_PAINT_IDLE_DELAY_MS;

/** @deprecated Prefer POST_PAINT_IDLE_TIMEOUT_MS. */
export const DESKTOP_WARMUP_IDLE_TIMEOUT_MS = POST_PAINT_IDLE_TIMEOUT_MS;

export type ScheduleDesktopWarmupStartOptions = SchedulePostPaintIdleOptions;

/**
 * N2a: defer `desktop_start_warmup` until after paint + idle (E23).
 */
export const scheduleDesktopWarmupStart = (
  start: () => void,
  options: ScheduleDesktopWarmupStartOptions = {},
): (() => void) => schedulePostPaintIdleWork(start, options);
