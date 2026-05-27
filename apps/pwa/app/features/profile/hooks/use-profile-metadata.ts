"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import { connectionStore } from "../../invites/utils/connection-store";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { fetchLatestEventFromRelayUrls } from "@/app/features/account-sync/services/direct-relay-query";
import { isDeletedAccountProfile } from "@/app/features/profile/utils/deleted-profile";

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
): ProfileMetadata => {
    const deletedIncoming = isDeletedAccountProfile({
        displayName: incoming.displayName,
        about: incoming.about,
    });
    return {
        pubkey: incoming.pubkey,
        displayName: incoming.displayName || existing?.displayName,
        avatarUrl: deletedIncoming
            ? undefined
            : (normalizePublicUrl(incoming.avatarUrl) || existing?.avatarUrl),
        nip05: incoming.nip05 || existing?.nip05,
        about: incoming.about || existing?.about,
    };
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

const metadataFingerprint = (metadata: ProfileMetadata | null | undefined): string => {
    if (!metadata) {
        return "";
    }
    return [
        metadata.pubkey,
        metadata.displayName ?? "",
        metadata.avatarUrl ?? "",
        metadata.nip05 ?? "",
        metadata.about ?? "",
    ].join("\0");
};

const persistMetadataIfChanged = (metadata: ProfileMetadata): ProfileMetadata => {
    const normalized = {
        ...metadata,
        avatarUrl: normalizePublicUrl(metadata.avatarUrl),
    };
    const previous = metadataCache.get(metadata.pubkey);
    if (previous && metadataFingerprint(previous) === metadataFingerprint(normalized)) {
        return previous;
    }
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

export const seedProfileMetadataCache = (metadata: ProfileMetadata): void => {
    persistMetadataIfChanged(metadata);
};

export const clearProfileMetadataCache = (): void => {
    metadataCache.clear();
    directFetchState.clear();
};

/**
 * Hook to resolve and subscribe to user metadata (Kind 0)
 */
export const useProfileMetadata = (pubkey: string | null, options: UseProfileMetadataOptions = {}): ProfileMetadata | null => {
    const { relayPool: pool, enabledRelayUrls } = useRelay();
    const live = options.live ?? true;
    const enabledRelayUrlsKey = enabledRelayUrls.join("|");
    const poolRef = useRef(pool);
    poolRef.current = pool;
    const [metadata, setMetadata] = useState<ProfileMetadata | null>(() => {
        if (!pubkey) return null;
        return metadataCache.get(pubkey) || null;
    });

    useEffect(() => {
        const activePool = poolRef.current;
        if (!pubkey || !activePool) {
            setMetadata(null);
            return;
        }

        let disposed = false;

        const applyMetadata = (incoming: ProfileMetadata): void => {
            if (disposed) {
                return;
            }
            const merged = mergeMetadata(metadataCache.get(pubkey), incoming);
            const persisted = persistMetadataIfChanged(merged);
            setMetadata((current) => {
                const next = mergeMetadata(current, persisted);
                if (metadataFingerprint(current) === metadataFingerprint(next)) {
                    return current;
                }
                return next;
            });
        };

        const cached = metadataCache.get(pubkey);
        if (cached) {
            setMetadata((current) => (
                metadataFingerprint(current) === metadataFingerprint(cached) ? current : cached
            ));
        } else {
            setMetadata((current) => (current === null ? current : null));
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
            return () => {
                disposed = true;
            };
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

        const subId = activePool.subscribe(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            (event: NostrEvent) => {
                const freshMetadata = metadataFromEvent(event);
                if (freshMetadata) {
                    applyMetadata(freshMetadata);
                }
            },
        );

        const relayUrls = enabledRelayUrlsKey.length > 0 ? enabledRelayUrlsKey.split("|") : [];
        const shouldFetchDirect = needsRelayHydration(metadataCache.get(pubkey))
            && relayUrls.length > 0
            && !directFetchState.has(pubkey);
        if (shouldFetchDirect) {
            const directFetch = fetchLatestEventFromRelayUrls({
                relayUrls,
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
                activePool.unsubscribe(subId);
            }
        };
    }, [enabledRelayUrlsKey, live, pubkey]);

    return metadata;
};
