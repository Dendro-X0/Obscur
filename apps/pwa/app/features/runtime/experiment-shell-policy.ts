/**
 * Experiment shell: loadability over feature completeness.
 * Enabled via NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=1 or by default on desktop shell builds.
 *
 * IMPORTANT: use static `process.env.NEXT_PUBLIC_*` references only.
 * Dynamic `process.env[key]` is NOT inlined by Next.js and is always undefined in the browser.
 */

/** Bump when verifying dev HMR picked up a structural change (check in DevTools console). */
export const OBSCUR_DEV_CLIENT_STAMP = "2026-05-23-workspace-phase-3";

declare global {
  interface Window {
    __OBSCUR_EXPERIMENT_SHELL?: boolean;
    /** When true, experiment shell uses real relay/sync (G6 online modules). */
    __OBSCUR_EXPERIMENT_ONLINE?: boolean;
    /** Present in dev/desktop experiment builds — confirms client bundle age. */
    __OBSCUR_DEV_CLIENT_STAMP?: string;
  }
}

/** Call once at app boot so experiment mode survives env inlining edge cases. */
export const markExperimentShellBootFlag = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (isExperimentShellEnabled()) {
    window.__OBSCUR_EXPERIMENT_SHELL = true;
    window.__OBSCUR_DEV_CLIENT_STAMP = OBSCUR_DEV_CLIENT_STAMP;
    if (isExperimentOnlineEnabled()) {
      window.__OBSCUR_EXPERIMENT_ONLINE = true;
    }
  }
};

export const isExperimentShellEnabled = (): boolean => {
  if (typeof window !== "undefined" && window.__OBSCUR_EXPERIMENT_SHELL === true) {
    return true;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL === "1") {
    return true;
  }
  return process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1";
};

/**
 * G6: Real relay pool + account sync/projection while keeping experiment loadability deferrals
 * (groups hydrate, messaging SQLite idle-deferred, navigation warmup) **only in offline-stub mode**.
 * Set `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` (`pnpm dev:desktop:online`).
 *
 * G6-5: When online is set, deferrals are off — same heavy-work timing as non-experiment shell.
 */
export const isExperimentOnlineEnabled = (): boolean => {
  if (typeof window !== "undefined" && window.__OBSCUR_EXPERIMENT_ONLINE === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE === "1";
};

/** Noop relay / synthetic account sync — experiment default unless online flag is set. */
export const isExperimentOfflineStubEnabled = (): boolean => (
  isExperimentShellEnabled() && !isExperimentOnlineEnabled()
);

/** Defer hydrate / SQLite / idle work (12s timer or idle callback) — offline experiment stub only. */
export const shouldDeferExperimentHeavyWork = (): boolean => isExperimentOfflineStubEnabled();

/** Delay before deferred hydrate/sync/subscription work in experiment mode. */
export const EXPERIMENT_DEFER_HEAVY_WORK_MS = 12_000;

/** Run work during browser idle time (offline/native deferral). */
export const scheduleExperimentIdleWork = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return (): void => {};
  }
  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(() => {
      callback();
    }, { timeout: 3000 });
    return (): void => {
      window.cancelIdleCallback(idleId);
    };
  }
  const timerId = window.setTimeout(callback, 0);
  return (): void => {
    window.clearTimeout(timerId);
  };
};

export const scheduleExperimentDeferredWork = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return (): void => {};
  }
  const timerId = window.setTimeout(callback, EXPERIMENT_DEFER_HEAVY_WORK_MS);
  return (): void => {
    window.clearTimeout(timerId);
  };
};
