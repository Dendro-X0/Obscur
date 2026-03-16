"use client";

import { useEffect, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import { connectionStore } from "../../invites/utils/connection-store";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { fetchLatestEventFromRelayUrls } from "@/app/features/account-sync/services/direct-relay-query";

export interface ProfileMetadata {
    pubkey: PublicKeyHex;
    displayName?: string;
    avatarUrl?: string;
    nip05?: string;
    about?: string;
}

export interface UseProfileMetadataOptions {
    live?: boolean;
}

const metadataCache = new Map<string, ProfileMetadata>();
const directFetchState = new Map<string, Promise<void>>();

const mergeMetadata = (
    existing: ProfileMetadata | null | undefined,
    incoming: ProfileMetadata
): ProfileMetadata => ({
    pubkey: incoming.pubkey,
    displayName: incoming.displayName || existing?.displayName,
    avatarUrl: normalizePublicUrl(incoming.avatarUrl) || existing?.avatarUrl,
    nip05: incoming.nip05 || existing?.nip05,
    about: incoming.about || existing?.about,
});

const persistMetadata = (metadata: ProfileMetadata): ProfileMetadata => {
    const normalized = {
        ...metadata,
        avatarUrl: normalizePublicUrl(metadata.avatarUrl),
    };
    metadataCache.set(metadata.pubkey, normalized);
    discoveryCache.upsertProfile({
        pubkey: metadata.pubkey,
        displayName: normalized.displayName,
        about: normalized.about,
        picture: normalized.avatarUrl,
        nip05: normalized.nip05,
    });
    return normalized;
};

const metadataFromEvent = (event: NostrEvent): ProfileMetadata | null => {
    try {
        const content = JSON.parse(event.content) as Record<string, unknown>;
        if (!content || typeof content !== "object") {
            return null;
        }
        const displayName = typeof content.display_name === "string" && content.display_name.trim().length > 0
            ? content.display_name.trim()
            : (typeof content.name === "string" && content.name.trim().length > 0 ? content.name.trim() : undefined);
        return {
            pubkey: event.pubkey as PublicKeyHex,
            displayName,
            avatarUrl: typeof content.picture === "string" ? content.picture : (typeof content.avatar === "string" ? content.avatar : undefined),
            nip05: typeof content.nip05 === "string" ? content.nip05 : undefined,
            about: typeof content.about === "string" ? content.about : undefined,
        };
    } catch {
        return null;
    }
};

const hasMeaningfulMetadata = (metadata: ProfileMetadata | null | undefined): boolean => Boolean(
    metadata?.displayName || metadata?.avatarUrl || metadata?.about || metadata?.nip05
);

const needsRelayHydration = (metadata: ProfileMetadata | null | undefined): boolean => {
    if (!metadata) {
        return true;
    }
    if (!metadata.displayName) {
        return true;
    }
    return !metadata.avatarUrl && !metadata.about && !metadata.nip05;
};

export const seedProfileMetadataCache = (metadata: ProfileMetadata): void => {
    persistMetadata(metadata);
};

/**
 * Hook to resolve and subscribe to user metadata (Kind 0)
 */
export const useProfileMetadata = (pubkey: string | null, options: UseProfileMetadataOptions = {}): ProfileMetadata | null => {
    const { relayPool: pool, enabledRelayUrls } = useRelay();
    const live = options.live ?? true;
    const [metadata, setMetadata] = useState<ProfileMetadata | null>(() => {
        if (!pubkey) return null;
        return metadataCache.get(pubkey) || null;
    });

    useEffect(() => {
        if (!pubkey || !pool) {
            setMetadata(null);
            return;
        }

        let disposed = false;

        const applyMetadata = (incoming: ProfileMetadata): void => {
            if (disposed) {
                return;
            }
            const merged = persistMetadata(mergeMetadata(metadataCache.get(pubkey), incoming));
            setMetadata((current) => mergeMetadata(current, merged));
        };

        const cached = metadataCache.get(pubkey);
        if (cached) {
            queueMicrotask(() => {
                if (!disposed) {
                    setMetadata(cached);
                }
            });
        } else {
            setMetadata(null);
        }

        const cachedDiscoveryProfile = discoveryCache.getProfile(pubkey);
        if (cachedDiscoveryProfile) {
            applyMetadata({
                pubkey: pubkey as PublicKeyHex,
                displayName: cachedDiscoveryProfile.displayName || cachedDiscoveryProfile.name,
                avatarUrl: cachedDiscoveryProfile.picture,
                nip05: cachedDiscoveryProfile.nip05,
                about: cachedDiscoveryProfile.about,
            });
        }

        if (!live) {
            return;
        }

        void (async () => {
            try {
                const connection = await connectionStore.getConnectionByPublicKey(pubkey);
                if (!connection) {
                    return;
                }
                const fromStore: ProfileMetadata = {
                    pubkey: pubkey as PublicKeyHex,
                    displayName: connection.displayName || cachedDiscoveryProfile?.displayName || cachedDiscoveryProfile?.name,
                    avatarUrl: connection.avatar,
                    about: cachedDiscoveryProfile?.about,
                    nip05: cachedDiscoveryProfile?.nip05,
                };
                if (hasMeaningfulMetadata(fromStore)) {
                    applyMetadata(fromStore);
                }
            } catch (e) {
                console.warn("[ProfileMetadata] Error loading from store:", e);
            }
        })();

        const subId = pool.subscribe(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            (event: NostrEvent) => {
                const freshMetadata = metadataFromEvent(event);
                if (freshMetadata) {
                    applyMetadata(freshMetadata);
                }
            }
        );

        const shouldFetchDirect = needsRelayHydration(metadataCache.get(pubkey))
            && enabledRelayUrls.length > 0
            && !directFetchState.has(pubkey);
        if (shouldFetchDirect) {
            const directFetch = fetchLatestEventFromRelayUrls({
                relayUrls: enabledRelayUrls,
                filters: [{ kinds: [0], authors: [pubkey], limit: 1 }],
                matcher: (event) => event.kind === 0 && event.pubkey === pubkey,
            })
                .then((event) => {
                    if (!event) {
                        return;
                    }
                    const fetchedMetadata = metadataFromEvent(event);
                    if (fetchedMetadata) {
                        applyMetadata(fetchedMetadata);
                    }
                })
                .finally(() => {
                    directFetchState.delete(pubkey);
                });
            directFetchState.set(pubkey, directFetch);
        }

        return () => {
            disposed = true;
            if (subId) {
                pool.unsubscribe(subId);
            }
        };
    }, [enabledRelayUrls, live, pool, pubkey]);

    return metadata;
};
