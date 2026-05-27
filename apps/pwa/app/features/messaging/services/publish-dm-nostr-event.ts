import type { NostrEvent } from "@dweb/nostr/nostr-event";

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
