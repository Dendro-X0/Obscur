import { fetchCoordinationWithTimeout } from "./community-coordination-fetch";
import { getCoordinationBaseUrl, isCoordinationConfigured } from "./community-membership-sync-mode";

export type CoordinationHealthSnapshot = Readonly<{
    configured: boolean;
    baseUrl: string | null;
    healthy: boolean;
    checkedAtMs: number;
    errorMessage?: string;
}>;

const HEALTH_CACHE_MS = 15_000;
let cachedSnapshot: CoordinationHealthSnapshot | null = null;

const buildUnconfiguredSnapshot = (): CoordinationHealthSnapshot => ({
    configured: false,
    baseUrl: null,
    healthy: false,
    checkedAtMs: Date.now(),
    errorMessage: "coordination_not_configured",
});

export const probeCoordinationHealth = async (
    options?: Readonly<{ force?: boolean }>,
): Promise<CoordinationHealthSnapshot> => {
    if (!isCoordinationConfigured()) {
        cachedSnapshot = buildUnconfiguredSnapshot();
        return cachedSnapshot;
    }

    const baseUrl = getCoordinationBaseUrl();
    if (!baseUrl) {
        cachedSnapshot = buildUnconfiguredSnapshot();
        return cachedSnapshot;
    }

    const nowMs = Date.now();
    if (
        !options?.force
        && cachedSnapshot
        && cachedSnapshot.baseUrl === baseUrl
        && nowMs - cachedSnapshot.checkedAtMs < HEALTH_CACHE_MS
    ) {
        return cachedSnapshot;
    }

    try {
        const response = await fetchCoordinationWithTimeout(`${baseUrl}/health`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            cachedSnapshot = {
                configured: true,
                baseUrl,
                healthy: false,
                checkedAtMs: nowMs,
                errorMessage: `http_${response.status}`,
            };
            return cachedSnapshot;
        }
        const json: unknown = await response.json();
        const ok = Boolean(
            json
            && typeof json === "object"
            && (json as Record<string, unknown>).ok === true,
        );
        cachedSnapshot = {
            configured: true,
            baseUrl,
            healthy: ok,
            checkedAtMs: nowMs,
            errorMessage: ok ? undefined : "health_not_ok",
        };
        return cachedSnapshot;
    } catch (error) {
        cachedSnapshot = {
            configured: true,
            baseUrl,
            healthy: false,
            checkedAtMs: nowMs,
            errorMessage: error instanceof Error ? error.message : "fetch_failed",
        };
        return cachedSnapshot;
    }
};

export const clearCoordinationHealthCache = (): void => {
    cachedSnapshot = null;
};
