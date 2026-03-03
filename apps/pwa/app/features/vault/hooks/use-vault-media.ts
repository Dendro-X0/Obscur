"use client";

import { useEffect, useState, useMemo } from "react";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message, MediaItem } from "../../messaging/types";
import {
    deleteLocalMediaCacheItem,
    getLocalMediaIndexEntryByRemoteUrl,
    resolveLocalMediaUrl
} from "../services/local-media-store";

export type VaultMediaItem = Readonly<MediaItem & {
    id: string;
    remoteUrl: string;
    isLocalCached: boolean;
    localRelativePath: string | null;
}>;

/**
 * useVaultMedia
 * 
 * Aggregates all media (images, videos) from the local message database.
 * This is the core data provider for "The Vault".
 */
export function useVaultMedia() {
    const [mediaItems, setMediaItems] = useState<ReadonlyArray<VaultMediaItem>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = async () => {
        setIsLoading(true);
        try {
            // Get all messages from IndexedDB
            const allMessages = await messagingDB.getAll<Message>("messages");

            const aggregated: VaultMediaItem[] = [];

            const mediaCandidates: Array<{ msg: Message; attachment: NonNullable<Message["attachments"]>[number] }> = [];
            allMessages.forEach((msg) => {
                if (!msg.attachments || msg.attachments.length === 0) return;
                msg.attachments.forEach((attachment) => {
                    if (attachment.kind === "image" || attachment.kind === "video" || attachment.kind === "audio") {
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
                    localRelativePath: indexEntry?.relativePath ?? null
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
    };

    useEffect(() => {
        refresh();
    }, []);

    const stats = useMemo(() => {
        const imageCount = mediaItems.filter(item => item.attachment.kind === "image").length;
        const videoCount = mediaItems.filter(item => item.attachment.kind === "video").length;
        return { imageCount, videoCount, total: mediaItems.length };
    }, [mediaItems]);

    return {
        mediaItems,
        isLoading,
        error,
        refresh,
        deleteLocalCopy: async (remoteUrl: string) => {
            await deleteLocalMediaCacheItem(remoteUrl);
            await refresh();
        },
        stats
    };
}
