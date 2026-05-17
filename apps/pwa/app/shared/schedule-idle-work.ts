/**
 * Run work after the browser is idle (or after a short timeout fallback).
 */
export const scheduleIdleWork = (
    work: () => void,
    timeoutMs = 2_000,
): (() => void) => {
    if (typeof window === "undefined") {
        work();
        return () => undefined;
    }
    if (typeof window.requestIdleCallback === "function") {
        const handle = window.requestIdleCallback(work, { timeout: timeoutMs });
        return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(work, 64);
    return () => window.clearTimeout(timer);
};
