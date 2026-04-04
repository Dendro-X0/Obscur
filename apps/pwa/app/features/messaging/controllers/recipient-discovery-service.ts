import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { RelayPool } from "./enhanced-dm-controller";
import { validateRelayUrl } from "@/app/features/relays/utils/validate-relay-url";

const toTrustedRelayUrl = (candidate: string): string | null => {
    const validated = validateRelayUrl(candidate);
    return validated?.normalizedUrl ?? null;
};

const hasReadableRelayPermission = (permissions: unknown): boolean => {
    if (typeof permissions !== "object" || permissions === null) {
        return true;
    }
    const { read, write } = permissions as { read?: unknown; write?: unknown };
    if (typeof read === "boolean") {
        return read;
    }
    if (typeof write === "boolean" && write === true) {
        return false;
    }
    return true;
};

export interface RecipientDiscoveryParams {
    pool: RelayPool;
    recipientRelayCheckCache: { current: Set<string> };
    recipientRelayResolutionCache: { current: Map<string, ReadonlyArray<string>> };
}

/**
 * Verify if a recipient exists on the network
 */
export const verifyRecipient = async (
    params: Pick<RecipientDiscoveryParams, 'pool'>,
    pubkeyHex: PublicKeyHex
): Promise<{ exists: boolean; profile?: any }> => {
    const { pool } = params;
    const isPoolConnected = await pool.waitForConnection(3000);

    if (!isPoolConnected) {
        console.warn("[DMController] No relay connection for verification after timeout.");
    }

    return new Promise((resolve) => {
        const subId = `verify-${Math.random().toString(36).substring(7)}`;
        let found = false;
        let profile: any = undefined;

        const filter = {
            kinds: [0],
            authors: [pubkeyHex],
            limit: 1
        };

        const cleanup = pool.subscribeToMessages(({ message }: { message: string }) => {
            try {
                const parsed = JSON.parse(message);
                if (parsed[0] === "EVENT" && parsed[1] === subId) {
                    const event = parsed[2];
                    if (event.pubkey === pubkeyHex && event.kind === 0) {
                        found = true;
                        profile = JSON.parse(event.content);
                        cleanup();
                        resolve({ exists: true, profile });
                    }
                }
                if (parsed[0] === "EOSE" && parsed[1] === subId) {
                    cleanup();
                    if (!found) resolve({ exists: false });
                }
            } catch (e) { }
        });

        pool.sendToOpen(JSON.stringify(["REQ", subId, filter]));

        setTimeout(() => {
            cleanup();
            if (!found) resolve({ exists: false });
        }, 3000);
    });
};

/**
 * Discover and connect to a recipient's read relays
 */
export const ensureConnectedToRecipientRelays = async (
    params: RecipientDiscoveryParams,
    pubkey: string
): Promise<ReadonlyArray<string>> => {
    const { pool, recipientRelayCheckCache, recipientRelayResolutionCache } = params;

    const cachedRelays = recipientRelayResolutionCache.current.get(pubkey);
    if (recipientRelayCheckCache.current.has(pubkey) && cachedRelays && cachedRelays.length > 0) {
        return cachedRelays;
    }

    console.log(`Discovering relays for recipient: ${pubkey.slice(0, 8)}...`);

    return new Promise<ReadonlyArray<string>>((resolve) => {
        const subId = `relays-${Math.random().toString(36).substring(7)}`;
        const discoveredRelays = new Set<string>();
        let cleanup: () => void = () => { };

        const filter = {
            kinds: [10002, 3],
            authors: [pubkey],
            limit: 2
        };

        const finish = () => {
            cleanup();
            const resolvedRelays = Array.from(discoveredRelays);
            if (discoveredRelays.size > 0) {
                console.log(`Found ${discoveredRelays.size} relays for ${pubkey.slice(0, 8)}`);
                discoveredRelays.forEach(url => {
                    pool.addTransientRelay?.(url);
                });
                recipientRelayResolutionCache.current.set(pubkey, resolvedRelays);
                recipientRelayCheckCache.current.add(pubkey);
            } else {
                recipientRelayResolutionCache.current.delete(pubkey);
                recipientRelayCheckCache.current.delete(pubkey);
            }
            resolve(resolvedRelays);
        };

        cleanup = pool.subscribeToMessages(({ message }: { message: string }) => {
            try {
                const parsed = JSON.parse(message);
                if (parsed[0] === "EVENT" && parsed[1] === subId) {
                    const event = parsed[2] as NostrEvent;

                    if (event.kind === 10002) {
                        event.tags.forEach((tag: readonly string[]) => {
                            if (tag[0] === 'r' && tag[1]) {
                                const url = toTrustedRelayUrl(tag[1]);
                                const marker = tag[2];
                                if (url && (!marker || marker === 'read')) {
                                    discoveredRelays.add(url);
                                }
                            }
                        });
                    }
                    else if (event.kind === 3) {
                        try {
                            const relays = JSON.parse(event.content);
                            Object.entries(relays).forEach(([url, permissions]: [string, any]) => {
                                const trustedUrl = toTrustedRelayUrl(url);
                                if (trustedUrl && hasReadableRelayPermission(permissions)) {
                                    discoveredRelays.add(trustedUrl);
                                }
                            });
                        } catch (e) { }
                    }
                }
                if (parsed[0] === "EOSE" && parsed[1] === subId) {
                    finish();
                }
            } catch (e) { }
        });

        try {
            pool.sendToOpen(JSON.stringify(["REQ", subId, filter]));
        } catch (e) {
            resolve([]);
        }

        setTimeout(() => {
            finish();
        }, 2000);
    });
};
