/**
 * Thin-webview unlock ownership (Slice 1 accelerated).
 * Desktop uses the same subtract chrome proved — not another soak plane.
 *
 * Rule: one owner per lifecycle. Dual-owned bridge ticks are forbidden on unlock.
 * @see specs/backend/native-shell-thin-webview-design-2026-10.md
 */

import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  isChromePerfPlaneActive,
  scheduleExperimentDeferredWork,
  scheduleExperimentIdleWork,
} from "@/app/features/runtime/experiment-shell-policy";

/** Desktop (and chrome): never listTombstones from provider mount. */
export const shouldSkipMountTombstoneHydrate = (): boolean => {
  if (isChromePerfPlaneActive()) {
    return true;
  }
  return hasNativeRuntime();
};

/**
 * Desktop: do not auto-rehydrate/publish account-sync on unlock.
 * Chrome keeps hard offline stub via isExperimentOfflineStubEnabled.
 * Restore becomes explicit / later Slice (Rust-owned phase machine).
 */
export const shouldDeferAccountSyncOffUnlockPath = (): boolean => {
  if (isChromePerfPlaneActive()) {
    return false;
  }
  return hasNativeRuntime();
};

/** Skip auto startup rehydrate entirely on desktop (accel — stop unlock 30078 storm). */
export const shouldSkipAutoAccountSyncOnUnlock = (): boolean => (
  isChromePerfPlaneActive() || hasNativeRuntime()
);

/**
 * Desktop unlock shell: same owner subtract as chrome quarantine
 * (warmup / cold-repair / leases / workspace kernel / presence publish).
 */
export const shouldQuarantineDesktopUnlockOwners = (): boolean => (
  isChromePerfPlaneActive() || hasNativeRuntime()
);

/** Desktop: skip harvest IPC (picker/unlock) — soft stubs still flood PostMessage. */
export const shouldSkipProfileWebStorageHarvest = (): boolean => (
  isChromePerfPlaneActive() || hasNativeRuntime()
);

/** Prefer idle; fall back to deferred timer. */
export const scheduleUnlockPathHeavyWork = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return (): void => {};
  }
  if (typeof window.requestIdleCallback === "function") {
    return scheduleExperimentIdleWork(callback);
  }
  return scheduleExperimentDeferredWork(callback);
};
