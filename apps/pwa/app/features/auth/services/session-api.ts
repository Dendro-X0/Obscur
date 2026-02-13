import { invoke } from "@tauri-apps/api/core";

export interface SessionStatus {
    isActive: boolean;
    npub: string | null;
    isNative: boolean;
}

export class SessionApi {
    /**
     * Get the current status of the native session.
     * Checks if a key is loaded in memory and/or the OS keychain.
     */
    static async getSessionStatus(): Promise<SessionStatus> {
        try {
            return await invoke<SessionStatus>("get_session_status");
        } catch (e) {
            console.error("Failed to get session status:", e);
            return { isActive: false, npub: null, isNative: false };
        }
    }

    /**
     * Explicitly check if the app is running in a native environment.
     */
    static isNative(): boolean {
        return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    }
}
