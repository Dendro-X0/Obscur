import { isDmTransportRelayUrl } from "@/app/features/relays/services/relay-transport-scope";
import { assessWorkspaceCommunityTrust } from "./community-trust-policy";

export type InviteRelayHintPartition = Readonly<{
    dmRelayUrls: ReadonlyArray<string>;
    workspaceRelayUrls: ReadonlyArray<string>;
    rejected: ReadonlyArray<Readonly<{ relayUrl: string; reasonCode: string; userMessage: string }>>;
}>;

const normalizeRelayList = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of relayUrls) {
        const trimmed = raw.trim();
        if (!trimmed) {
            continue;
        }
        const relayUrl = /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
        const key = relayUrl.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(relayUrl);
    }
    return normalized;
};

/**
 * Splits coordination invite relay hints into DM-safe vs workspace-trusted URLs.
 * Public-default hosts may still be added for DM transport; they are never workspace hosts.
 */
export const partitionInviteRelayHints = (params: Readonly<{
    relayUrls: ReadonlyArray<string>;
    coordinationHealthy: boolean;
    enabledRelayUrls?: ReadonlyArray<string>;
}>): InviteRelayHintPartition => {
    const dmRelayUrls: string[] = [];
    const workspaceRelayUrls: string[] = [];
    const rejected: Array<{ relayUrl: string; reasonCode: string; userMessage: string }> = [];

    for (const relayUrl of normalizeRelayList(params.relayUrls)) {
        if (isDmTransportRelayUrl(relayUrl)) {
            dmRelayUrls.push(relayUrl);
            continue;
        }

        const trust = assessWorkspaceCommunityTrust({
            communityRelayUrl: relayUrl,
            enabledRelayUrls: params.enabledRelayUrls ?? [],
            coordinationHealthy: params.coordinationHealthy,
        });
        if (trust.allowed) {
            workspaceRelayUrls.push(relayUrl);
            continue;
        }

        rejected.push({
            relayUrl,
            reasonCode: trust.reasonCode,
            userMessage: trust.userMessage,
        });
    }

    return { dmRelayUrls, workspaceRelayUrls, rejected };
};

export const formatInviteRelayRejectionSummary = (
    rejected: InviteRelayHintPartition["rejected"],
): string | null => {
    if (rejected.length === 0) {
        return null;
    }
    const first = rejected[0];
    const extra = rejected.length > 1 ? ` (+${rejected.length - 1} more)` : "";
    return `${first.userMessage}${extra}`;
};
