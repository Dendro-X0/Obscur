"use client";

import { useEffect, useState, useMemo } from "react";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message, MediaItem } from "../../messaging/types";

/**
 * useVaultMedia
 * 
 * Aggregates all media (images, videos) from the local message database.
 * This is the core data provider for "The Vault".
 */
export function useVaultMedia() {
    const [mediaItems, setMediaItems] = useState<ReadonlyArray<MediaItem>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = async () => {
        setIsLoading(true);
        try {
            // Get all messages from IndexedDB
            const allMessages = await messagingDB.getAll<Message>("messages");

            const aggregated: MediaItem[] = [];

            allMessages.forEach(msg => {
                if (msg.attachments && msg.attachments.length > 0) {
                    msg.attachments.forEach(attachment => {
                        // We only want images and videos for now
                        if (attachment.kind === "image" || attachment.kind === "video") {
                            aggregated.push({
                                messageId: msg.id,
                                attachment,
                                timestamp: new Date(msg.timestamp)
                            });
                        }
                    });
                }
            });

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
        stats
    };
}
