
/**
 * Background Service Utility
 * 
 * Uses tauri-plugin-background to keep the mobile app connection alive
 * for a short duration after backgrounding.
 */

export async function initBackgroundService() {
    if (typeof window === "undefined") return;

    try {
        const { isRegistered, register } = await eval('import("@tauri-apps/plugin-background")');

        if (await isRegistered()) {
            console.info("[BackgroundService] Already registered.");
            return;
        }

        await register({
            matches: ["*"], // Keep alive for all URLs
            // We don't necessarily need a callback if we just want to avoid suspension
            // but we can add a no-op or a heartbeat if needed.
        });

        console.info("[BackgroundService] Registered successfully.");
    } catch (e) {
        // Not in Tauri or plugin not available
        console.warn("[BackgroundService] Not available in this environment.");
    }
}
