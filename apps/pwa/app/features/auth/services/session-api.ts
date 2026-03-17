import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";

export interface SessionStatus {
    isActive: boolean;
    npub: string | null;
    isNative: boolean;
}

type MobileSecurityDiagnostics = Readonly<{
    owner: "rust_secure_store" | "locked_no_secure_key" | "legacy_transport";
    sessionActive: boolean;
    detail: string;
    atUnixMs: number;
}>;

const setMobileSecurityDiagnostics = (diagnostics: MobileSecurityDiagnostics): void => {
    if (typeof window === "undefined") {
        return;
    }
    (window as Window & { obscurMobileSecurityDiagnostics?: MobileSecurityDiagnostics }).obscurMobileSecurityDiagnostics = diagnostics;
};

type SessionStatusWire = Readonly<{
    isActive?: boolean;
    is_active?: boolean;
    npub?: string | null;
    isNative?: boolean;
    is_native?: boolean;
}>;

const normalizeSessionStatus = (payload: SessionStatusWire | null | undefined): SessionStatus => {
    const isActive = payload?.isActive ?? payload?.is_active ?? false;
    const isNative = payload?.isNative ?? payload?.is_native ?? true;
    const npub = typeof payload?.npub === "string" && payload.npub.trim().length > 0
        ? payload.npub
        : null;
    return {
        isActive: Boolean(isActive),
        npub,
        isNative: Boolean(isNative),
    };
};

export class SessionApi {
    /**
     * Get the current status of the native session.
     * Checks if a key is loaded in memory and/or the OS keychain.
     */
    static async getSessionStatus(): Promise<SessionStatus> {
        if (!hasNativeRuntime()) {
            setMobileSecurityDiagnostics({
                owner: "legacy_transport",
                sessionActive: false,
                detail: "non_native_runtime",
                atUnixMs: Date.now(),
            });
            return { isActive: false, npub: null, isNative: false };
        }
        const statusResult = await invokeNativeCommand<SessionStatusWire>("get_session_status", undefined, { timeoutMs: 3_000 });
        if (statusResult.ok) {
            const normalized = normalizeSessionStatus(statusResult.value);
            if (normalized.isActive) {
                setMobileSecurityDiagnostics({
                    owner: "rust_secure_store",
                    sessionActive: true,
                    detail: "session_active",
                    atUnixMs: Date.now(),
                });
                return normalized;
            }
        }

        // Fallback rehydration path for native profile windows: get_native_npub can
        // restore in-memory session from keychain when status payload is stale.
        const npubResult = await invokeNativeCommand<string | null>("get_native_npub", undefined, { timeoutMs: 3_000 });
        if (npubResult.ok && typeof npubResult.value === "string" && npubResult.value.trim().length > 0) {
            setMobileSecurityDiagnostics({
                owner: "rust_secure_store",
                sessionActive: true,
                detail: "session_restored",
                atUnixMs: Date.now(),
            });
            return {
                isActive: true,
                npub: npubResult.value,
                isNative: true,
            };
        }

        setMobileSecurityDiagnostics({
            owner: "locked_no_secure_key",
            sessionActive: false,
            detail: "identity_locked_or_missing_secure_key",
            atUnixMs: Date.now(),
        });
        return { isActive: false, npub: null, isNative: false };
    }

    /**
     * Explicitly check if the app is running in a native environment.
     */
    static isNative(): boolean {
        return hasNativeRuntime();
    }
}
