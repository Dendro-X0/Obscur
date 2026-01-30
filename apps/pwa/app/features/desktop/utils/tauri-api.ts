/**
 * Tauri API Integration Layer
 * Provides TypeScript types and safe access to Tauri APIs with fallbacks for web environment
 */

// Type definitions for Tauri APIs
export interface TauriWindow {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
  setTitle(title: string): Promise<void>;
  isMaximized(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  isFullscreen(): Promise<boolean>;
}

export interface TauriNotification {
  show(options: { title: string; body: string }): Promise<void>;
  requestPermission(): Promise<"granted" | "denied" | "default">;
  isPermissionGranted(): Promise<boolean>;
}

export interface TauriTheme {
  getTheme(): Promise<"light" | "dark" | null>;
  onThemeChanged(callback: (theme: "light" | "dark") => void): Promise<() => void>;
}

export interface TauriUpdater {
  checkForUpdates(): Promise<{ available: boolean; version?: string }>;
  installUpdate(): Promise<void>;
}

export interface TauriFileSystem {
  saveFile(data: string, filename: string): Promise<void>;
  openFile(): Promise<string | null>;
}

export interface TauriAPI {
  window: TauriWindow;
  notification: TauriNotification;
  theme: TauriTheme;
  updater: TauriUpdater;
  fileSystem: TauriFileSystem;
}

/**
 * Detect if running in Tauri desktop environment
 */
export function isDesktopEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // Check for Tauri-specific global
  return "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
}

/**
 * Get Tauri invoke function safely
 */
function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  if (!isDesktopEnvironment()) {
    return null;
  }
  try {
    // Access Tauri's invoke function
    const tauri = (window as any).__TAURI_INTERNALS__;
    if (tauri && typeof tauri.invoke === "function") {
      return tauri.invoke;
    }
    // Fallback to older Tauri API structure
    const tauriLegacy = (window as any).__TAURI__;
    if (tauriLegacy && tauriLegacy.core && typeof tauriLegacy.core.invoke === "function") {
      return tauriLegacy.core.invoke;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Safe wrapper for Tauri invoke calls
 */
async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  const invoke = getTauriInvoke();
  if (!invoke) {
    console.warn(`Tauri command "${command}" not available in web environment`);
    return null;
  }
  try {
    return (await invoke(command, args)) as T;
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    return null;
  }
}

/**
 * Create Tauri API with fallbacks for web environment
 */
export function createTauriAPI(): TauriAPI {
  const isDesktop = isDesktopEnvironment();

  return {
    window: {
      async minimize() {
        if (!isDesktop) return;
        await invokeTauri("window_minimize");
      },
      async maximize() {
        if (!isDesktop) return;
        await invokeTauri("window_maximize");
      },
      async unmaximize() {
        if (!isDesktop) return;
        await invokeTauri("window_unmaximize");
      },
      async close() {
        if (!isDesktop) return;
        await invokeTauri("window_close");
      },
      async setTitle(title: string) {
        if (!isDesktop) return;
        // Title setting is handled by Tauri's built-in API
        try {
          const tauri = (window as any).__TAURI_INTERNALS__;
          if (tauri && tauri.window) {
            await tauri.window.getCurrent().setTitle(title);
          }
        } catch (error) {
          console.error("Failed to set window title:", error);
        }
      },
      async isMaximized() {
        if (!isDesktop) return false;
        const result = await invokeTauri<boolean>("window_is_maximized");
        return result ?? false;
      },
      async setFullscreen(fullscreen: boolean) {
        if (!isDesktop) return;
        await invokeTauri("window_set_fullscreen", { fullscreen });
      },
      async isFullscreen() {
        if (!isDesktop) return false;
        const result = await invokeTauri<boolean>("window_is_fullscreen");
        return result ?? false;
      },
    },
    notification: {
      async show(options: { title: string; body: string }) {
        if (!isDesktop) {
          // Fallback to web notifications
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(options.title, { body: options.body });
          }
          return;
        }
        await invokeTauri("show_notification", { title: options.title, body: options.body });
      },
      async requestPermission() {
        if (!isDesktop) {
          // Fallback to web notification permission
          if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            return permission;
          }
          return "denied";
        }
        const result = await invokeTauri<string>("request_notification_permission");
        return (result as "granted" | "denied" | "default") ?? "denied";
      },
      async isPermissionGranted() {
        if (!isDesktop) {
          // Fallback to web notification permission
          if ("Notification" in window) {
            return Notification.permission === "granted";
          }
          return false;
        }
        const result = await invokeTauri<boolean>("is_notification_permission_granted");
        return result ?? false;
      },
    },
    theme: {
      async getTheme() {
        if (!isDesktop) {
          // Fallback to web media query
          if (typeof window !== "undefined" && window.matchMedia) {
            const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            return isDark ? "dark" : "light";
          }
          return null;
        }
        const result = await invokeTauri<string>("get_system_theme");
        return (result as "light" | "dark") ?? null;
      },
      async onThemeChanged(callback: (theme: "light" | "dark") => void) {
        if (!isDesktop) {
          // Fallback to web media query listener
          if (typeof window !== "undefined" && window.matchMedia) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const listener = (e: MediaQueryListEvent) => {
              callback(e.matches ? "dark" : "light");
            };
            mediaQuery.addEventListener("change", listener);
            return () => mediaQuery.removeEventListener("change", listener);
          }
          return () => {};
        }
        // For desktop, poll for theme changes (Tauri doesn't have built-in theme change events)
        const checkTheme = async () => {
          const theme = await invokeTauri<string>("get_system_theme");
          if (theme) {
            callback(theme as "light" | "dark");
          }
        };
        
        // Poll every 5 seconds
        const interval = setInterval(checkTheme, 5000);
        return () => clearInterval(interval);
      },
    },
    updater: {
      async checkForUpdates() {
        if (!isDesktop) {
          return { available: false };
        }
        const result = await invokeTauri<string>("check_for_updates");
        if (result && result.includes("Update available")) {
          const version = result.split(": ")[1];
          return { available: true, version };
        }
        return { available: false };
      },
      async installUpdate() {
        if (!isDesktop) return;
        await invokeTauri("install_update");
      },
    },
    fileSystem: {
      async saveFile(data: string, filename: string) {
        if (!isDesktop) {
          // Fallback to web download
          const blob = new Blob([data], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
        await invokeTauri("save_file", { data, filename });
      },
      async openFile() {
        if (!isDesktop) {
          // Fallback to web file input
          return new Promise<string | null>((resolve) => {
            const input = document.createElement("input");
            input.type = "file";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const text = await file.text();
                resolve(text);
              } else {
                resolve(null);
              }
            };
            input.click();
          });
        }
        const result = await invokeTauri<string>("open_file");
        return result;
      },
    },
  };
}

// Singleton instance
let tauriAPI: TauriAPI | null = null;

/**
 * Get the Tauri API instance (singleton)
 */
export function getTauriAPI(): TauriAPI {
  if (!tauriAPI) {
    tauriAPI = createTauriAPI();
  }
  return tauriAPI;
}
