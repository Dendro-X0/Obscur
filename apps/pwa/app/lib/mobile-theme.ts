
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

export const isTauriMobile = () => {
    return getRuntimeCapabilities().isMobile;
};

export enum StatusBarStyle {
    Light = "Light",
    Dark = "Dark",
}

export async function syncStatusBarTheme(isDark: boolean) {
    if (!isTauriMobile()) return;

    try {
        await invokeNativeCommand("plugin:statusbar|set_style", {
            style: isDark ? StatusBarStyle.Dark : StatusBarStyle.Light
        });
    } catch (err) {
        console.error("Failed to sync status bar theme:", err);
    }
}
