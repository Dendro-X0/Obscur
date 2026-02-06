
import { invoke } from "@tauri-apps/api/core";

export const isTauriMobile = () => {
    return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.metadata?.mobile;
};

export enum StatusBarStyle {
    Light = "Light",
    Dark = "Dark",
}

export async function syncStatusBarTheme(isDark: boolean) {
    if (!isTauriMobile()) return;

    try {
        await invoke("plugin:statusbar|set_style", {
            style: isDark ? StatusBarStyle.Dark : StatusBarStyle.Light
        });
    } catch (err) {
        console.error("Failed to sync status bar theme:", err);
    }
}
