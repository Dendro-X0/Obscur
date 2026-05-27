/**
 * Runtime operator trust bundle (coordination + workspace relay).
 * Build-time `NEXT_PUBLIC_COORDINATION_URL` remains the default; operators may override per device.
 */

const COORDINATION_OVERRIDE_KEY = "obscur.operator.coordination_url.v1";
const WORKSPACE_RELAY_KEY = "obscur.operator.workspace_relay.v1";

const trimUrl = (raw: string): string => raw.trim().replace(/\/+$/, "");

const readStorage = (key: string): string | null => {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(key)?.trim();
        return raw ? trimUrl(raw) : null;
    } catch {
        return null;
    }
};

const writeStorage = (key: string, value: string | null): void => {
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (!value?.trim()) {
            window.localStorage.removeItem(key);
            return;
        }
        window.localStorage.setItem(key, trimUrl(value));
    } catch {
        // ignore
    }
};

export type CoordinationUrlSource = "runtime_override" | "build_env" | "none";

export const readOperatorCoordinationUrlOverride = (): string | null => (
    readStorage(COORDINATION_OVERRIDE_KEY)
);

export const writeOperatorCoordinationUrlOverride = (url: string | null): void => {
    writeStorage(COORDINATION_OVERRIDE_KEY, url);
};

export const readOperatorWorkspaceRelayUrl = (): string | null => (
    readStorage(WORKSPACE_RELAY_KEY)
);

export const writeOperatorWorkspaceRelayUrl = (relayUrl: string | null): void => {
    writeStorage(WORKSPACE_RELAY_KEY, relayUrl);
};

export const clearOperatorTrustConfig = (): void => {
    writeOperatorCoordinationUrlOverride(null);
    writeOperatorWorkspaceRelayUrl(null);
};

export const getCoordinationUrlSource = (): CoordinationUrlSource => {
    if (readOperatorCoordinationUrlOverride()) {
        return "runtime_override";
    }
    const env = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
    return env ? "build_env" : "none";
};

/** Effective coordination base URL: runtime override, then build env. */
export const resolveCoordinationBaseUrl = (): string | null => {
    const override = readOperatorCoordinationUrlOverride();
    if (override) {
        return override;
    }
    const raw = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
    return raw ? trimUrl(raw) : null;
};

export const normalizeOperatorRelayUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }
    return /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
};
