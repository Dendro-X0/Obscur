import { logAppEvent } from "@/app/shared/log-app-event";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { readDesktopWindowBootPayload } from "./desktop-window-boot-payload";
import type { LocalSaveLibraryScanResult } from "./local-save-contracts";
import {
  clearLocalSaveLibraryScanCache,
  mergeLocalSaveLibraryScanResults,
  scanLocalSaveLibraryAtRoots,
} from "./local-save-library-service";
import {
  buildDefaultSaveLibraryScanRoots,
  buildPrioritySaveLibraryScanRoots,
  getSaveLibraryContext,
} from "./local-save-scan-roots";

export type LocalSaveLibraryScanBootstrapPhase =
  | "idle"
  | "fast"
  | "deep"
  | "complete"
  | "error";

export type LocalSaveLibraryScanBootstrapState = Readonly<{
  phase: LocalSaveLibraryScanBootstrapPhase;
  result: LocalSaveLibraryScanResult | null;
  error: string | null;
  windowLabel: string | null;
  launchMode: "existing" | "new_window" | null;
}>;

type BootstrapListener = (state: LocalSaveLibraryScanBootstrapState) => void;

const CONTEXT_RETRY_DELAY_MS = 400;
const CONTEXT_RETRY_ATTEMPTS = 6;

let bootstrapState: LocalSaveLibraryScanBootstrapState = {
  phase: "idle",
  result: null,
  error: null,
  windowLabel: null,
  launchMode: null,
};

let bootstrapInFlight: Promise<void> | null = null;
let bootstrapStartedForWindow: string | null = null;
const listeners = new Set<BootstrapListener>();

const notifyListeners = (): void => {
  const snapshot = bootstrapState;
  listeners.forEach((listener) => {
    listener(snapshot);
  });
};

const setBootstrapState = (
  patch: Partial<LocalSaveLibraryScanBootstrapState>,
): void => {
  bootstrapState = {
    ...bootstrapState,
    ...patch,
  };
  notifyListeners();
};

export const getLocalSaveLibraryScanBootstrapState = (): LocalSaveLibraryScanBootstrapState => (
  bootstrapState
);

export const subscribeLocalSaveLibraryScanBootstrap = (
  listener: BootstrapListener,
): (() => void) => {
  listeners.add(listener);
  listener(bootstrapState);
  return () => {
    listeners.delete(listener);
  };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const resolveSaveLibraryContext = async () => {
  for (let attempt = 0; attempt < CONTEXT_RETRY_ATTEMPTS; attempt += 1) {
    const context = await getSaveLibraryContext();
    if (context) {
      return context;
    }
    if (attempt < CONTEXT_RETRY_ATTEMPTS - 1) {
      await sleep(CONTEXT_RETRY_DELAY_MS);
    }
  }
  return null;
};

export const startLocalSaveLibraryWindowBootstrap = async (): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const bootPayload = readDesktopWindowBootPayload();
  const windowLabel = bootPayload?.windowLabel ?? null;
  if (windowLabel && bootstrapStartedForWindow === windowLabel && bootstrapInFlight) {
    return bootstrapInFlight;
  }
  if (windowLabel) {
    bootstrapStartedForWindow = windowLabel;
  }

  const run = async (): Promise<void> => {
    const launchMode = bootPayload?.launchMode ?? null;
    setBootstrapState({
      phase: "fast",
      result: null,
      error: null,
      windowLabel,
      launchMode,
    });

    clearLocalSaveLibraryScanCache();

    try {
      const context = await resolveSaveLibraryContext();
      const priorityRoots = buildPrioritySaveLibraryScanRoots(context);
      const dedupedFullRoots = await buildDefaultSaveLibraryScanRoots();

      if (priorityRoots.length === 0 && dedupedFullRoots.length === 0) {
        throw new Error("Could not resolve Obscur data folders to scan.");
      }

      const fastResult = priorityRoots.length > 0
        ? await scanLocalSaveLibraryAtRoots(priorityRoots, {
          force: true,
          maxDepth: 2,
          maxResults: 96,
        })
        : null;

      if (fastResult) {
        setBootstrapState({
          phase: "deep",
          result: fastResult,
          error: null,
        });
      } else {
        setBootstrapState({ phase: "deep" });
      }

      logAppEvent({
        name: "profiles.local_save_scan_fast_complete",
        level: "info",
        scope: { feature: "profiles", action: "local_save_scan" },
        context: {
          windowLabel,
          launchMode,
          entryCount: fastResult?.entries.length ?? 0,
          durationMs: fastResult?.durationMs ?? 0,
          rootCount: priorityRoots.length,
        },
      });

      const deepResult = await scanLocalSaveLibraryAtRoots(dedupedFullRoots, {
        force: true,
        maxDepth: 5,
        maxResults: 240,
      });

      const merged = fastResult
        ? mergeLocalSaveLibraryScanResults(fastResult, deepResult)
        : deepResult;

      setBootstrapState({
        phase: "complete",
        result: merged,
        error: null,
      });

      logAppEvent({
        name: "profiles.local_save_scan_deep_complete",
        level: "info",
        scope: { feature: "profiles", action: "local_save_scan" },
        context: {
          windowLabel,
          launchMode,
          entryCount: merged.entries.length,
          durationMs: merged.durationMs,
          truncated: merged.truncated,
          rootCount: dedupedFullRoots.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local save scan failed.";
      setBootstrapState({
        phase: "error",
        error: message,
      });
      logAppEvent({
        name: "profiles.local_save_scan_bootstrap_failed",
        level: "warn",
        scope: { feature: "profiles", action: "local_save_scan" },
        context: {
          windowLabel,
          launchMode,
          message,
        },
      });
    }
  };

  bootstrapInFlight = run().finally(() => {
    bootstrapInFlight = null;
  });
  return bootstrapInFlight;
};

export const localSaveLibraryScanBootstrapInternals = {
  resetBootstrapStateForTests: (): void => {
    bootstrapState = {
      phase: "idle",
      result: null,
      error: null,
      windowLabel: null,
      launchMode: null,
    };
    bootstrapInFlight = null;
    bootstrapStartedForWindow = null;
    listeners.clear();
  },
};
