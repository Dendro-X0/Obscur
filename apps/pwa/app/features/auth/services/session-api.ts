import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

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
        if (!hasNativeRuntime()) {
            return { isActive: false, npub: null, isNative: false };
        }
        const result = await invokeNativeCommand<SessionStatus>("get_session_status");
        if (!result.ok) return { isActive: false, npub: null, isNative: false };
        return result.value;
    }

    /**
     * Explicitly check if the app is running in a native environment.
     */
    static isNative(): boolean {
        return hasNativeRuntime();
    }
}
