"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message, MediaItem } from "../../messaging/types";
import { useOptionalProfileMessageBus } from "../../profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "../../profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "../../profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeMessagesIndexRebuiltDual } from "../../profiles/services/subscribe-messages-index-rebuilt-dual";
import { useIdentity } from "../../auth/hooks/use-identity";
import {
    deleteLocalMediaCacheItem,
    downloadAttachmentToUserPath,
    getLocalMediaIndexEntryByRemoteUrl,
    resolveLocalMediaUrl
} from "../services/local-media-store";

export type VaultMediaItem = Readonly<MediaItem & {
    id: string;
    remoteUrl: string;
    isLocalCached: boolean;
    localRelativePath: string | null;
    sourceConversationId: string | null;
}>;

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

    const refresh = useCallback(async () => {
        if (!publicKeyHex) {
            setMediaItems([]);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // Get all messages from IndexedDB
            const allMessages = await messagingDB.getAll<Message>("messages");

            const aggregated: VaultMediaItem[] = [];

            const mediaCandidates: Array<{ msg: Message; attachment: NonNullable<Message["attachments"]>[number] }> = [];
            allMessages.forEach((msg) => {
                if (!msg.attachments || msg.attachments.length === 0) return;
                msg.attachments.forEach((attachment) => {
                    if (attachment.kind === "image" || attachment.kind === "video" || attachment.kind === "audio" || attachment.kind === "file") {
                        mediaCandidates.push({ msg, attachment });
                    }
                });
            });

            const resolvedItems = await Promise.all(mediaCandidates.map(async ({ msg, attachment }, idx) => {
                const localUrl = await resolveLocalMediaUrl(attachment.url);
                const indexEntry = getLocalMediaIndexEntryByRemoteUrl(attachment.url);
                return {
                    id: `${msg.id}-${idx}-${attachment.url}`,
                    messageId: msg.id,
                    attachment: localUrl ? { ...attachment, url: localUrl } : attachment,
                    timestamp: new Date(msg.timestamp),
                    remoteUrl: attachment.url,
                    isLocalCached: !!localUrl,
                    localRelativePath: indexEntry?.relativePath ?? null,
                    sourceConversationId: typeof msg.conversationId === "string" && msg.conversationId.trim().length > 0
                        ? msg.conversationId
                        : null,
                } as VaultMediaItem;
            }));

            aggregated.push(...resolvedItems);

            // Sort by timestamp descending
            aggregated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

            setMediaItems(aggregated);
            setError(null);
        } catch (e) {
            console.error("[useVaultMedia] Failed to aggregate media:", e);
            setError(e instanceof Error ? e : new Error("Unknown error during media aggregation"));
        } finally {
            setIsLoading(false);
        }
    }, [publicKeyHex]);

    useEffect(() => {
        void refresh();
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
