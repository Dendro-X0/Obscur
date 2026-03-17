
import { registerNativeBackgroundService } from "@/app/features/runtime/native-host-adapter";

/**
 * Background Service Utility
 * 
 * Uses tauri-plugin-background to keep the mobile app connection alive
 * for a short duration after backgrounding.
 */

export async function initBackgroundService() {
    if (typeof window === "undefined") return;

    const registered = await registerNativeBackgroundService();
    if (registered) {
        console.info("[BackgroundService] Registered successfully.");
        return;
    }

    console.warn("[BackgroundService] Not available in this environment.");
}
