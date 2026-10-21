"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { fetchLatestEventFromRelayUrls } from "@/app/features/account-sync/services/direct-relay-query";
import { isDeletedAccountProfile } from "@/app/features/profile/utils/deleted-profile";
import {
  countOpenRelayConnections,
  nextProfileMetadataHydrateDelayMs,
  shouldRetryProfileMetadataOnPoolRecovery,
  shouldScheduleProfileMetadataHydrateRetry,
} from "./profile-metadata-hydrate-retry";

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
const metadataCacheListeners = new Set<() => void>();
const directFetchState = new Map<string, Promise<void>>();
const hydrateAttemptByPubkey = new Map<string, number>();
const hydrateRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const lastOpenRelayCountByPubkey = new Map<string, number>();
/** Pubkeys that received a relay kind-0 event this session (not local name seeds). */
const relayKind0AppliedByPubkey = new Set<string>();

const notifyMetadataCacheListeners = (): void => {
    metadataCacheListeners.forEach((listener) => {
        listener();
    });
};

const subscribeMetadataCache = (listener: () => void): (() => void) => {
    metadataCacheListeners.add(listener);
    return (): void => {
        metadataCacheListeners.delete(listener);
    };
};

const clearHydrateRetryTimer = (pubkey: string): void => {
    const timer = hydrateRetryTimers.get(pubkey);
    if (!timer) {
        return;
    }
    clearTimeout(timer);
    hydrateRetryTimers.delete(pubkey);
};

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
    // Keep fishing for a picture even when name/about already exist from local seeds
    // or a sparse kind-0 — about/nip05 alone must not cancel avatar hydrate.
    if (!metadata.displayName || !metadata.avatarUrl) {
        return true;
    }
    return false;
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
    const cacheKey = metadata.pubkey.trim().toLowerCase() as PublicKeyHex;
    const normalized = {
        ...metadata,
        pubkey: cacheKey,
        avatarUrl: normalizePublicUrl(metadata.avatarUrl),
    };
    const previous = metadataCache.get(cacheKey);
    if (previous && metadataFingerprint(previous) === metadataFingerprint(normalized)) {
        return previous;
    }
    metadataCache.set(cacheKey, normalized);
    discoveryCache.upsertProfile({
        pubkey: cacheKey,
        displayName: normalized.displayName,
        about: normalized.about,
        picture: normalized.avatarUrl,
        nip05: normalized.nip05,
    });
    notifyMetadataCacheListeners();
    return normalized;
};

export const seedProfileMetadataCache = (metadata: ProfileMetadata): void => {
    const cacheKey = metadata.pubkey.trim().toLowerCase() as PublicKeyHex;
    const existing = metadataCache.get(cacheKey);
    const merged = mergeMetadata(existing, { ...metadata, pubkey: cacheKey });
    const persisted = persistMetadataIfChanged(merged);
    // Local seeds must not cancel relay avatar hydrate — only clear when complete.
    if (!needsRelayHydration(persisted)) {
        clearHydrateRetryTimer(persisted.pubkey);
    }
};

export const clearProfileMetadataCache = (): void => {
    metadataCache.clear();
    directFetchState.clear();
    for (const timer of hydrateRetryTimers.values()) {
        clearTimeout(timer);
    }
    hydrateRetryTimers.clear();
    hydrateAttemptByPubkey.clear();
    lastOpenRelayCountByPubkey.clear();
    relayKind0AppliedByPubkey.clear();
    notifyMetadataCacheListeners();
};

/**
 * Hook to resolve and subscribe to user metadata (Kind 0).
 * M1: auto-retries direct kind-0 hydrate on empty/fail and when open relay count recovers.
 */
export const useProfileMetadata = (pubkey: string | null, options: UseProfileMetadataOptions = {}): ProfileMetadata | null => {
    const { relayPool: pool, enabledRelayUrls } = useRelay();
    const live = options.live ?? true;
    const enabledRelayUrlsKey = enabledRelayUrls.join("|");
    const openRelayCount = countOpenRelayConnections(pool?.connections ?? []);
    const poolRef = useRef(pool);
    poolRef.current = pool;
    const [metadata, setMetadata] = useState<ProfileMetadata | null>(() => {
        if (!pubkey) return null;
        const cacheKey = pubkey.trim().toLowerCase();
        return metadataCache.get(cacheKey) || metadataCache.get(pubkey) || null;
    });

    useEffect(() => {
        if (!pubkey) {
            return;
        }
        const cacheKey = pubkey.trim().toLowerCase();
        return subscribeMetadataCache(() => {
            const cached = metadataCache.get(cacheKey);
            if (!cached) {
                return;
            }
            setMetadata((current) => (
                metadataFingerprint(current) === metadataFingerprint(cached) ? current : cached
            ));
        });
    }, [pubkey]);

    useEffect(() => {
        const activePool = poolRef.current;
        if (!pubkey || !activePool) {
            setMetadata(null);
            return;
        }

        const cacheKey = pubkey.trim().toLowerCase();
        let disposed = false;

        const applyMetadata = (
            incoming: ProfileMetadata,
            options?: Readonly<{ fromRelayKind0?: boolean }>,
        ): void => {
            if (disposed) {
                return;
            }
            const normalizedIncoming: ProfileMetadata = {
                ...incoming,
                pubkey: cacheKey as PublicKeyHex,
            };
            const merged = mergeMetadata(metadataCache.get(cacheKey), normalizedIncoming);
            const persisted = persistMetadataIfChanged(merged);
            if (options?.fromRelayKind0) {
                relayKind0AppliedByPubkey.add(cacheKey);
            }
            if (!needsRelayHydration(persisted)) {
                clearHydrateRetryTimer(cacheKey);
            }
            setMetadata((current) => {
                const next = mergeMetadata(current, persisted);
                if (metadataFingerprint(current) === metadataFingerprint(next)) {
                    return current;
                }
                return next;
            });
        };

        const cached = metadataCache.get(cacheKey) || metadataCache.get(pubkey);
        if (cached) {
            setMetadata((current) => (
                metadataFingerprint(current) === metadataFingerprint(cached) ? current : cached
            ));
        } else {
            setMetadata((current) => (current === null ? current : null));
        }

        const cachedDiscoveryProfile = discoveryCache.getProfile(cacheKey);
        if (cachedDiscoveryProfile) {
            applyMetadata({
                pubkey: cacheKey as PublicKeyHex,
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

        const subId = activePool.subscribe(
            [{ kinds: [0], authors: [cacheKey], limit: 1 }],
            (event: NostrEvent) => {
                const freshMetadata = metadataFromEvent(event);
                if (freshMetadata) {
                    applyMetadata(freshMetadata, { fromRelayKind0: true });
                }
            },
        );

        const relayUrls = enabledRelayUrlsKey.length > 0 ? enabledRelayUrlsKey.split("|") : [];

        const scheduleHydrateRetry = (): void => {
            if (disposed) {
                return;
            }
            const attemptCount = hydrateAttemptByPubkey.get(cacheKey) ?? 0;
            if (!shouldScheduleProfileMetadataHydrateRetry({
                needsHydration: needsRelayHydration(metadataCache.get(cacheKey)),
                live: true,
                hasRelayUrls: relayUrls.length > 0,
                attemptCount,
                appliedRelayKind0: relayKind0AppliedByPubkey.has(cacheKey),
            })) {
                return;
            }
            const delayMs = nextProfileMetadataHydrateDelayMs(Math.max(0, attemptCount - 1));
            if (delayMs == null) {
                return;
            }
            clearHydrateRetryTimer(cacheKey);
            const timer = setTimeout(() => {
                hydrateRetryTimers.delete(cacheKey);
                runDirectHydrate();
            }, delayMs);
            hydrateRetryTimers.set(cacheKey, timer);
        };

        const runDirectHydrate = (): void => {
            if (disposed) {
                return;
            }
            if (!needsRelayHydration(metadataCache.get(cacheKey))) {
                return;
            }
            if (relayUrls.length === 0) {
                return;
            }
            if (directFetchState.has(cacheKey)) {
                return;
            }

            const attemptCount = (hydrateAttemptByPubkey.get(cacheKey) ?? 0) + 1;
            hydrateAttemptByPubkey.set(cacheKey, attemptCount);

            const directFetch = fetchLatestEventFromRelayUrls({
                relayUrls,
                filters: [{ kinds: [0], authors: [cacheKey], limit: 1 }],
                matcher: (event) => (
                    event.kind === 0 && event.pubkey.trim().toLowerCase() === cacheKey
                ),
            })
                .then((event) => {
                    if (event) {
                        const fetchedMetadata = metadataFromEvent(event);
                        if (fetchedMetadata) {
                            applyMetadata(fetchedMetadata, { fromRelayKind0: true });
                        }
                    }
                    if (needsRelayHydration(metadataCache.get(cacheKey))) {
                        scheduleHydrateRetry();
                    }
                })
                .catch(() => {
                    scheduleHydrateRetry();
                })
                .finally(() => {
                    directFetchState.delete(cacheKey);
                });
            directFetchState.set(cacheKey, directFetch);
        };

        const previousOpenCount = lastOpenRelayCountByPubkey.get(cacheKey) ?? 0;
        const poolRecovered = shouldRetryProfileMetadataOnPoolRecovery({
            needsHydration: needsRelayHydration(metadataCache.get(cacheKey)),
            previousOpenCount,
            nextOpenCount: openRelayCount,
        });
        lastOpenRelayCountByPubkey.set(cacheKey, openRelayCount);

        if (poolRecovered) {
            clearHydrateRetryTimer(cacheKey);
            runDirectHydrate();
        } else if (
            needsRelayHydration(metadataCache.get(cacheKey))
            && relayUrls.length > 0
            && !directFetchState.has(cacheKey)
            && !hydrateRetryTimers.has(cacheKey)
        ) {
            if ((hydrateAttemptByPubkey.get(cacheKey) ?? 0) === 0) {
                runDirectHydrate();
            } else {
                scheduleHydrateRetry();
            }
        }

        return () => {
            disposed = true;
            clearHydrateRetryTimer(cacheKey);
            if (subId) {
                activePool.unsubscribe(subId);
            }
        };
    }, [enabledRelayUrlsKey, live, openRelayCount, pubkey]);

    return metadata;
};
