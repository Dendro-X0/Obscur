"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useOptionalProfileMessageBus } from "../../profiles/providers/profile-runtime-provider";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import { subscribeChatStateReplacedDual } from "../../profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeMessagesIndexRebuiltDual } from "../../profiles/services/subscribe-messages-index-rebuilt-dual";
import { useIdentity } from "../../auth/hooks/use-identity";
import { useNetwork } from "../../network/providers/network-provider";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import { requiresAttachmentExportConfirm } from "@/app/features/dm-kernel/dm-kernel-trust-export-action-gate";
import { getPeerFirstSeenAtUnixMs } from "@/app/features/dm-kernel/dm-kernel-trust-peer-state";
import { buildVaultAttachmentExportGateInput } from "../services/vault-attachment-export-gate";
import {
    deleteLocalMediaCacheItem,
    downloadAttachmentToUserPath,
    ensureVaultMediaIndexReadyForActiveProfile,
    revealLocalMediaItemPath,
    subscribeLocalMediaIndexChanged,
    revokeAllVaultMediaBlobUrls,
} from "../services/local-media-store";
import {
    buildVaultMediaItemsFast,
    buildStandaloneLocalVaultMediaItems,
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
    const { t } = useTranslation();
    const identity = useIdentity();
    const { peerTrust } = useNetwork();
    const optionalProfileBus = useOptionalProfileMessageBus();
    const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const activeProfileId = resolveVaultProfileId();
    const [mediaItems, setMediaItems] = useState<ReadonlyArray<VaultMediaItem>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [pendingExportFileName, setPendingExportFileName] = useState<string | null>(null);
    const pendingExportRunnerRef = useRef<(() => Promise<boolean>) | null>(null);
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
        revokeAllVaultMediaBlobUrls();
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
                mergeStandaloneLocalVaultItems(buildVaultMediaItemsFast(candidates)),
            );
            setMediaItems(fastItems);
            setError(null);
            hasPaintedVaultRef.current = true;
            setIsLoading(false);
        };

        const mergeStandaloneLocalVaultItems = (messageItems: ReadonlyArray<VaultMediaItem>): VaultMediaItem[] => {
            const existingUrls = new Set(messageItems.map((item) => item.remoteUrl));
            const standalone = buildStandaloneLocalVaultMediaItems(existingUrls);
            if (standalone.length === 0) {
                return [...messageItems];
            }
            return sortVaultMediaItemsNewestFirst([...messageItems, ...standalone]);
        };

        try {
            await ensureVaultMediaIndexReadyForActiveProfile();
            // Paint disk inventory immediately (before possibly-slow message scan).
            paintCandidates([]);

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

            const fastItems = mergeStandaloneLocalVaultItems(
                sortVaultMediaItemsNewestFirst(
                    buildVaultMediaItemsFast(accumulatedCandidates),
                ),
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
            revokeAllVaultMediaBlobUrls();
        };
    }, [publicKeyHex, activeProfileId, refresh]);

    useEffect(() => {
        const unsubIndex = subscribeMessagesIndexRebuiltDual((detail) => {
            if (detail.publicKeyHex && publicKeyHex && detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            if (detail.profileId && detail.profileId !== resolveVaultProfileId()) {
                return;
            }
            void refresh();
        }, optionalProfileBus);
        const unsubChatReplace = subscribeChatStateReplacedDual((detail) => {
            if (detail?.publicKeyHex && publicKeyHex && detail.publicKeyHex !== publicKeyHex) {
                return;
            }
            if (detail?.profileId && detail.profileId !== resolveVaultProfileId()) {
                return;
            }
            void refresh();
        }, optionalProfileBus);
        return () => {
            unsubIndex();
            unsubChatReplace();
        };
    }, [optionalProfileBus, publicKeyHex, refresh]);

    useEffect(() => {
        const unsubscribe = subscribeLocalMediaIndexChanged(() => {
            void refresh();
        });
        return unsubscribe;
    }, [refresh]);

    const stats = useMemo(() => {
        const imageCount = mediaItems.filter(item => item.attachment.kind === "image").length;
        const videoCount = mediaItems.filter(item => item.attachment.kind === "video").length;
        const audioCount = mediaItems.filter(item => item.attachment.kind === "audio").length;
        const fileCount = mediaItems.filter(item => item.attachment.kind === "file").length;
        return { imageCount, videoCount, audioCount, fileCount, total: mediaItems.length };
    }, [mediaItems]);

    const cancelExportConfirm = useCallback((): void => {
        pendingExportRunnerRef.current = null;
        setPendingExportFileName(null);
    }, []);

    const confirmExport = useCallback(async (): Promise<boolean> => {
        const runner = pendingExportRunnerRef.current;
        pendingExportRunnerRef.current = null;
        setPendingExportFileName(null);
        if (!runner) {
            return false;
        }
        return runner();
    }, []);

    const downloadToLocalPath = useCallback(async (item: VaultMediaItem): Promise<boolean> => {
        const runExport = async (): Promise<boolean> => {
            const exported = await downloadAttachmentToUserPath({
                attachment: item.attachment,
                sourceUrl: item.remoteUrl,
            });
            if (exported) {
                toast.success(t("vault.exportDecryptedCopySuccess"));
            }
            return exported;
        };

        if (!publicKeyHex) {
            return runExport();
        }

        const gateInput = buildVaultAttachmentExportGateInput(item, {
            myPublicKeyHex: publicKeyHex,
            isPeerAccepted: (peerPublicKeyHex) => (
                peerTrust.isAccepted({ publicKeyHex: peerPublicKeyHex as PublicKeyHex })
            ),
            getPeerFirstSeenAtUnixMs: (peerPublicKeyHex) => (
                getPeerFirstSeenAtUnixMs(resolveVaultProfileId(), peerPublicKeyHex)
            ),
        });

        if (requiresAttachmentExportConfirm(gateInput)) {
            pendingExportRunnerRef.current = runExport;
            setPendingExportFileName(item.attachment.fileName ?? "attachment");
            return false;
        }

        return runExport();
    }, [peerTrust, publicKeyHex, t]);

    return {
        mediaItems,
        isLoading,
        error,
        refresh,
        downloadToLocalPath,
        pendingExportFileName,
        cancelExportConfirm,
        confirmExport,
        deleteLocalCopy: async (remoteUrl: string) => {
            await deleteLocalMediaCacheItem(remoteUrl);
            await refresh();
        },
        openLocalFileLocation: async (remoteUrl: string) => {
            return revealLocalMediaItemPath(remoteUrl);
        },
        stats
    };
}
