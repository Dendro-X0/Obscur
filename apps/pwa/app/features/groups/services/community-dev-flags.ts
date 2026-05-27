import { resolveCoordinationBaseUrl } from "./operator-trust-config";

/**
 * Local developer escapes when Docker/relay infrastructure is unavailable.
 * Env: `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` in apps/pwa/.env.local (rebuild required)
 * Runtime: Settings → Relays → Operator setup → "Test without local Nostr relay"
 */
const COORDINATION_ONLY_DEV_STORAGE_KEY = "obscur.dev.coordination_only_workspace.v1";
/** When curl/terminal proves coordination is up but desktop WebView probe fails (loopback restrictions). */
const ASSUME_LOCAL_COORDINATION_STORAGE_KEY = "obscur.dev.assume_local_coordination.v1";

export const WORKSPACE_DEV_FLAGS_CHANGED_EVENT = "obscur:workspace-dev-flags-changed";

export const notifyWorkspaceDevFlagsChanged = (): void => {
    if (typeof window === "undefined") {
        return;
    }
    window.dispatchEvent(new CustomEvent(WORKSPACE_DEV_FLAGS_CHANGED_EVENT));
};

const envCoordinationOnlyWorkspaceDevMode = (): boolean => {
    const raw = (process.env.NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE ?? "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes";
};

export const readCoordinationOnlyWorkspaceDevModeOverride = (): boolean => {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return window.localStorage.getItem(COORDINATION_ONLY_DEV_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
};

export const writeCoordinationOnlyWorkspaceDevModeOverride = (enabled: boolean): void => {
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (enabled) {
            window.localStorage.setItem(COORDINATION_ONLY_DEV_STORAGE_KEY, "1");
        } else {
            window.localStorage.removeItem(COORDINATION_ONLY_DEV_STORAGE_KEY);
        }
        notifyWorkspaceDevFlagsChanged();
    } catch {
        // ignore
    }
};

export const isCoordinationOnlyWorkspaceDevMode = (): boolean => (
    envCoordinationOnlyWorkspaceDevMode() || readCoordinationOnlyWorkspaceDevModeOverride()
);

export const readAssumeLocalCoordinationReachable = (): boolean => {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return window.localStorage.getItem(ASSUME_LOCAL_COORDINATION_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
};

export const writeAssumeLocalCoordinationReachable = (enabled: boolean): void => {
    if (typeof window === "undefined") {
        return;
    }
    try {
        if (enabled) {
            window.localStorage.setItem(ASSUME_LOCAL_COORDINATION_STORAGE_KEY, "1");
        } else {
            window.localStorage.removeItem(ASSUME_LOCAL_COORDINATION_STORAGE_KEY);
        }
        notifyWorkspaceDevFlagsChanged();
    } catch {
        // ignore
    }
};

/**
 * Whether workspace create/join gates treat coordination as reachable.
 *
 * Production: requires a successful `/health` probe (or operator assume-local).
 * Dev (`NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE`): configured URL is enough —
 * Tauri WebView often cannot reach loopback even when `curl` / browser can.
 */
export const isCoordinationGateSatisfied = (probedHealthy: boolean | null): boolean => {
    if (!isCoordinationConfigured()) {
        return false;
    }
    if (probedHealthy === true) {
        return true;
    }
    if (readAssumeLocalCoordinationReachable()) {
        return true;
    }
    if (isCoordinationOnlyWorkspaceDevMode()) {
        return true;
    }
    return probedHealthy === null;
};

const isCoordinationConfigured = (): boolean => resolveCoordinationBaseUrl() !== null;

/** R1: new workspace communities use coordination directory, not nostr_only roster hints. */
export const isWorkspaceR1MembershipEnforced = (): boolean => {
    const raw = (process.env.NEXT_PUBLIC_WORKSPACE_R1_MEMBERSHIP ?? "").trim().toLowerCase();
    if (raw === "0" || raw === "false" || raw === "off") {
        return false;
    }
    return true;
};
