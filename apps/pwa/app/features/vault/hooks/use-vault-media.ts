"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useOptionalProfileMessageBus } from "../../profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "../../profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "../../profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeMessagesIndexRebuiltDual } from "../../profiles/services/subscribe-messages-index-rebuilt-dual";
import { useIdentity } from "../../auth/hooks/use-identity";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import {
    deleteLocalMediaCacheItem,
    downloadAttachmentToUserPath,
} from "../services/local-media-store";
import {
    buildVaultMediaItemsFast,
    enrichVaultMediaItemsWithLocalUrls,
    sortVaultMediaItemsNewestFirst,
    VAULT_INITIAL_ENRICH_LIMIT,
    type VaultMediaCandidate,
} from "../services/vault-media-aggregator";
import { mergeVaultMediaCandidates } from "../services/vault-candidate-merge";
import { scanMessagesForVaultMedia } from "../services/vault-message-scan";
import type { VaultMediaItem } from "../types/vault-media-item";

export type { VaultMediaItem } from "../types/vault-media-item";

/**
 * useVaultMedia
 *
 * Aggregates all media (images, videos, audio, and files) from the local message database.
 * This is the core data provider for "The Vault".
 */
export function useVaultMedia() {
    const identity = useIdentity();
    const optionalProfileBus = useOptionalProfileMessageBus();
    const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const [mediaItems, setMediaItems] = useState<ReadonlyArray<VaultMediaItem>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const refreshGenerationRef = useRef(0);
    const hasPaintedVaultRef = useRef(false);
    const deferredEnrichCancelRef = useRef<(() => void) | undefined>(undefined);

    const refresh = useCallback(async () => {
        deferredEnrichCancelRef.current?.();
        deferredEnrichCancelRef.current = undefined;

        if (!publicKeyHex) {
            refreshGenerationRef.current += 1;
            hasPaintedVaultRef.current = false;
            setMediaItems([]);
            setError(null);
            setIsLoading(false);
            return;
        }

        const generation = refreshGenerationRef.current + 1;
        refreshGenerationRef.current = generation;
        const showBlockingLoader = !hasPaintedVaultRef.current;
        if (showBlockingLoader) {
            setIsLoading(true);
        }

        let accumulatedCandidates: VaultMediaCandidate[] = [];

        const paintCandidates = (candidates: ReadonlyArray<VaultMediaCandidate>): void => {
            if (generation !== refreshGenerationRef.current) {
                return;
            }
            const fastItems = sortVaultMediaItemsNewestFirst(
                buildVaultMediaItemsFast(candidates),
            );
            setMediaItems(fastItems);
            setError(null);
            hasPaintedVaultRef.current = true;
            setIsLoading(false);
        };

        try {
            await scanMessagesForVaultMedia({
                isCancelled: () => generation !== refreshGenerationRef.current,
                onCandidatesBatch: (batch) => {
                    if (generation !== refreshGenerationRef.current || batch.length === 0) {
                        return;
                    }
                    accumulatedCandidates = mergeVaultMediaCandidates(accumulatedCandidates, batch);
                    paintCandidates(accumulatedCandidates);
                },
            });

            if (generation !== refreshGenerationRef.current) {
                return;
            }

            const fastItems = sortVaultMediaItemsNewestFirst(
                buildVaultMediaItemsFast(accumulatedCandidates),
            );
            setMediaItems(fastItems);
            setError(null);
            hasPaintedVaultRef.current = true;
            setIsLoading(false);

            const initialEnriched = await enrichVaultMediaItemsWithLocalUrls(fastItems, {
                limit: VAULT_INITIAL_ENRICH_LIMIT,
            });
            if (generation !== refreshGenerationRef.current) {
                return;
            }
            setMediaItems(sortVaultMediaItemsNewestFirst(initialEnriched));

            if (fastItems.length > VAULT_INITIAL_ENRICH_LIMIT) {
                deferredEnrichCancelRef.current = scheduleIdleWork(() => {
                    void (async () => {
                        const fullyEnriched = await enrichVaultMediaItemsWithLocalUrls(fastItems, {
                            offset: VAULT_INITIAL_ENRICH_LIMIT,
                        });
                        if (generation !== refreshGenerationRef.current) {
                            return;
                        }
                        setMediaItems(sortVaultMediaItemsNewestFirst(fullyEnriched));
                    })();
                });
            }
        } catch (e) {
            if (generation !== refreshGenerationRef.current) {
                return;
            }
            console.error("[useVaultMedia] Failed to aggregate media:", e);
            setError(e instanceof Error ? e : new Error("Unknown error during media aggregation"));
            setIsLoading(false);
        }
    }, [publicKeyHex]);

    useEffect(() => {
        void refresh();
        return () => {
            deferredEnrichCancelRef.current?.();
            deferredEnrichCancelRef.current = undefined;
        };
    }, [publicKeyHex, refresh]);

    useEffect(() => {
        const unsubIndex = subscribeMessagesIndexRebuiltDual((detail) => {
            if (detail.publicKeyHex && publicKeyHex && detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            if (detail.profileId && detail.profileId !== getResolvedProfileId()) {
                return;
            }
            void refresh();
        }, optionalProfileBus);
        const unsubChatReplace = subscribeChatStateReplacedDual((detail) => {
            if (detail?.publicKeyHex && publicKeyHex && detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            if (detail?.profileId && detail.profileId !== getResolvedProfileId()) {
                return;
            }
            void refresh();
        }, optionalProfileBus);
        return () => {
            unsubIndex();
            unsubChatReplace();
        };
    }, [optionalProfileBus, publicKeyHex, refresh]);

    const stats = useMemo(() => {
        const imageCount = mediaItems.filter(item => item.attachment.kind === "image").length;
        const videoCount = mediaItems.filter(item => item.attachment.kind === "video").length;
        const audioCount = mediaItems.filter(item => item.attachment.kind === "audio").length;
        const fileCount = mediaItems.filter(item => item.attachment.kind === "file").length;
        return { imageCount, videoCount, audioCount, fileCount, total: mediaItems.length };
    }, [mediaItems]);

    return {
        mediaItems,
        isLoading,
        error,
        refresh,
        downloadToLocalPath: async (item: VaultMediaItem) => {
            return downloadAttachmentToUserPath({
                attachment: item.attachment,
                sourceUrl: item.attachment.url || item.remoteUrl,
            });
        },
        deleteLocalCopy: async (remoteUrl: string) => {
            await deleteLocalMediaCacheItem(remoteUrl);
            await refresh();
        },
        stats
    };
}
