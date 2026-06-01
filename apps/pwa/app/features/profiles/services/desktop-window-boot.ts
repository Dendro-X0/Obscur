import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { logAppEvent } from "@/app/shared/log-app-event";
import { APP_BOOT_READY_EVENT } from "@/app/features/runtime/app-boot-ready-event";
import { isSecondaryProfileWindowLabel } from "./desktop-profile-window-label";
import {
  applyCachedWindowProfileScope,
  applyDesktopWindowBootPayload,
  applyWindowLabelProfileScope,
  desktopProfileRuntime,
  resetDesktopProfileRefreshState,
  resolveNativeWindowLabel,
} from "./desktop-profile-runtime";
import { readDesktopWindowBootPayload } from "./desktop-window-boot-payload";

const WINDOW_LABEL_RESOLVE_TIMEOUT_MS = 250;
const MAIN_WINDOW_LABEL = "main";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const markDesktopShellBootReady = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const globalRoot = window as Window & {
    __obscurBootReady?: boolean;
  };
  if (globalRoot.__obscurBootReady === true) {
    return;
  }
  globalRoot.__obscurBootReady = true;
  window.dispatchEvent(new Event(APP_BOOT_READY_EVENT));
};

const resolveWindowLabelWithTimeout = async (): Promise<string> => {
  if (!hasNativeRuntime()) {
    return MAIN_WINDOW_LABEL;
  }
  try {
    return await Promise.race([
      resolveNativeWindowLabel(),
      sleep(WINDOW_LABEL_RESOLVE_TIMEOUT_MS).then(() => MAIN_WINDOW_LABEL),
    ]);
  } catch {
    return MAIN_WINDOW_LABEL;
  }
};

const applySynchronousProfileScope = (windowLabel: string): boolean => (
  applyWindowLabelProfileScope(windowLabel)
  || applyCachedWindowProfileScope(windowLabel)
);

/**
 * Desktop shell boot contract: never block the React tree on native profile IPC.
 * Scope is derived synchronously from the window label / cache, then native reconciles in the background.
 */
export const startDesktopWindowBoot = (): void => {
  resetDesktopProfileRefreshState();

  if (!hasNativeRuntime()) {
    markDesktopShellBootReady();
    return;
  }

  const bootPayloadApplied = applyDesktopWindowBootPayload();
  const bootPayload = readDesktopWindowBootPayload();
  const bootWindowLabel = bootPayload?.windowLabel;
  if (bootWindowLabel) {
    applyWindowLabelProfileScope(bootWindowLabel)
      || applyCachedWindowProfileScope(bootWindowLabel);
  }

  markDesktopShellBootReady();

  void (async () => {
    const windowLabel = bootWindowLabel ?? await resolveWindowLabelWithTimeout();
    const scopeApplied = bootPayloadApplied || applySynchronousProfileScope(windowLabel);

    logAppEvent({
      name: "runtime.desktop_window_boot_ready",
      level: "debug",
      scope: { feature: "runtime", action: "profile_boot" },
      context: {
        windowLabel,
        scopeApplied,
        profileId: desktopProfileRuntime.getSnapshot().currentWindow.profileId,
      },
    });

    void desktopProfileRuntime.refresh().catch(() => {
      // Background reconcile only.
    });

    if (isSecondaryProfileWindowLabel(windowLabel)) {
      try {
        await invokeNativeCommand("window_reveal_current");
      } catch {
        // Native failsafe reveal remains available.
      }
    }
  })();
};
