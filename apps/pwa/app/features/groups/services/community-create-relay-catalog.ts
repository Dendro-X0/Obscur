import type { RelayHealthMetrics } from "@/app/features/relays/hooks/relay-health-monitor";
import type { RelayConnection } from "@/app/features/relays/hooks/relay-connection";
import { deriveRelayNodeStatus, type RelayUiStatus } from "@/app/features/relays/lib/relay-runtime-status";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import { isPublicDefaultRelayHost, normalizeRelayHost } from "./community-mode-contract";
import { isCommunityRelayCandidateUrl } from "@/app/features/relays/services/relay-transport-scope";

export type CommunityCreateRelayOption = Readonly<{
    host: string;
    relayUrl: string;
    selectable: boolean;
    disabledReason?: string;
    status: RelayUiStatus;
    badge: string;
    detail: string;
    isPublicDefault: boolean;
}>;

const hostFromRelayUrl = (relayUrl: string): string => (
    relayUrl.replace(/^wss?:\/\//i, "").replace(/\/$/, "")
);

const normalizeRelayUrlForMatch = (relayUrl: string): string => {
    const trimmed = relayUrl.trim();
    return trimmed.startsWith("ws") ? trimmed : `wss://${trimmed}`;
};

const findConnectionForRelay = (
    relayUrl: string,
    connections: ReadonlyArray<RelayConnection>,
): RelayConnection | undefined => {
    const normalized = normalizeRelayUrlForMatch(relayUrl).toLowerCase();
    return connections.find((connection) => (
        normalizeRelayUrlForMatch(connection.url).toLowerCase() === normalized
    ));
};

export const resolveCommunityCreateRelayOptions = (params: Readonly<{
    relays: ReadonlyArray<{ url: string; enabled: boolean }>;
    connections: ReadonlyArray<RelayConnection>;
    activePoolRelayUrls?: ReadonlyArray<string>;
    getHealth?: (relayUrl: string) => RelayHealthMetrics | undefined;
    forManagedWorkspace?: boolean;
    /** When true, private/intranet hosts stay selectable even if the socket is disconnected (coordination-only dev). */
    allowDisconnectedPrivateRelays?: boolean;
}>): ReadonlyArray<CommunityCreateRelayOption> => {
    const forManagedWorkspace = params.forManagedWorkspace !== false;
    const allowDisconnectedPrivateRelays = params.allowDisconnectedPrivateRelays === true;
    const activePool = new Set(
        (params.activePoolRelayUrls ?? []).map((url) => normalizeRelayUrlForMatch(url).toLowerCase()),
    );
    const options: CommunityCreateRelayOption[] = [];

    for (const relay of params.relays) {
        if (!relay.enabled || !isCommunityRelayCandidateUrl(relay.url)) {
            continue;
        }
        const relayUrl = normalizeRelayUrlForMatch(relay.url);
        const host = hostFromRelayUrl(relayUrl);
        const isPublicDefault = isPublicDefaultRelayHost(host);
        const inActivePool = activePool.has(relayUrl.toLowerCase());
        const connection = inActivePool
            ? findConnectionForRelay(relayUrl, params.connections)
            : undefined;
        const metrics = params.getHealth?.(relayUrl);
        const nodeStatus = deriveRelayNodeStatus({
            url: relayUrl,
            enabled: true,
            connection,
            metrics,
        });

        let selectable = hasWritableCommunityRelayTransport(relayUrl);
        let disabledReason: string | undefined;

        if (!selectable) {
            disabledReason = "Not a writable Nostr relay (needs wss:// with a real host/port).";
        } else if (forManagedWorkspace && isPublicDefault) {
            selectable = false;
            disabledReason = "Public relays cannot host Managed Workspace communities.";
        } else if (nodeStatus.status === "unavailable") {
            if (allowDisconnectedPrivateRelays && !isPublicDefault) {
                selectable = true;
                disabledReason = undefined;
            } else {
                selectable = false;
                disabledReason = nodeStatus.detail;
            }
        }

        options.push({
            host,
            relayUrl,
            selectable,
            disabledReason,
            status: nodeStatus.status,
            badge: allowDisconnectedPrivateRelays && nodeStatus.status === "unavailable" && selectable
                ? "DEV"
                : nodeStatus.badge,
            detail: allowDisconnectedPrivateRelays && nodeStatus.status === "unavailable" && selectable
                ? "Coordination-only dev: membership works without a live Nostr relay; chat publish stays local until a relay connects."
                : nodeStatus.detail,
            isPublicDefault,
        });
    }

    return options;
};

export const pickDefaultCommunityCreateRelayHost = (
    options: ReadonlyArray<CommunityCreateRelayOption>,
): string => {
    const selectable = options.filter((option) => option.selectable);
    const healthy = selectable.find((option) => option.status === "healthy");
    if (healthy) {
        return healthy.host;
    }
    const degraded = selectable.find((option) => option.status === "degraded");
    if (degraded) {
        return degraded.host;
    }
    return selectable[0]?.host ?? "";
};
