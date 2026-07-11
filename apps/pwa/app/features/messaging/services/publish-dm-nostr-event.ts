import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

type MultiRelayPublishResult = Readonly<{
    success: boolean;
    successCount: number;
    totalRelays: number;
    overallError?: string;
}>;

type DmPublishPool = Readonly<{
    publishToUrls?: (
        urls: ReadonlyArray<string>,
        payload: string,
    ) => Promise<MultiRelayPublishResult>;
    publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

/**
 * Community invite DMs must reach the workspace relay encoded in the invite payload,
 * even when that relay is classified as community_candidate (excluded from DM transport scope).
 */
export const resolveCommunityInviteDmPublishRelayUrls = (
    dmRelayUrls: ReadonlyArray<string>,
    workspaceRelayUrl?: string,
): ReadonlyArray<string> => {
    const normalizedDmUrls = dmRelayUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    const normalizedWorkspaceUrl = workspaceRelayUrl?.trim() ?? "";
    if (!normalizedWorkspaceUrl) {
        return normalizedDmUrls;
    }
    if (normalizedDmUrls.some((url) => workspaceRelayUrlsMatch(url, normalizedWorkspaceUrl))) {
        return normalizedDmUrls;
    }
    return [normalizedWorkspaceUrl, ...normalizedDmUrls];
};

/** Publish a NIP-17 gift-wrap / DM event on DM-scoped relays (not workspace-only relays). */
export const publishDmNostrEvent = async (
    pool: DmPublishPool,
    dmRelayUrls: ReadonlyArray<string>,
    event: NostrEvent,
): Promise<MultiRelayPublishResult> => {
    const payload = JSON.stringify(["EVENT", event]);
    const scopedUrls = dmRelayUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
    if (scopedUrls.length > 0 && typeof pool.publishToUrls === "function") {
        return pool.publishToUrls(scopedUrls, payload);
    }
    if (typeof pool.publishToAll === "function") {
        return pool.publishToAll(payload);
    }
    return {
        success: false,
        successCount: 0,
        totalRelays: scopedUrls.length,
        overallError: "Relay pool does not support DM publish APIs.",
    };
};
