"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Message, Conversation } from "../types";
import { messagingDB } from "@dweb/storage/indexed-db";
import { messageBus, type MessageBusEvent } from "../services/message-bus";

interface UseConversationMessagesResult {
    messages: ReadonlyArray<Message>;
    isLoading: boolean;
    hasEarlier: boolean;
    loadEarlier: () => Promise<void>;
}

const INITIAL_BATCH_SIZE = 100;
const LOAD_EARLIER_BATCH_SIZE = 100;

/**
 * useConversationMessages Hook
 * 
 * Manages the message list for a specific conversation.
 * Loads history from IndexedDB and listens for real-time updates via MessageBus.
 */
export function useConversationMessages(
    conversationId: string | undefined,
    publicKeyHex: string | null
): UseConversationMessagesResult {
    const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasEarlier, setHasEarlier] = useState(false);
    const [loadedCount, setLoadedCount] = useState(INITIAL_BATCH_SIZE);

    // Initial load from IndexedDB
    const hydrateHistory = useCallback(async (cid: string) => {
        setIsLoading(true);
        try {
            // Use the new composite index [conversationId, timestampMs] for fast retrieval
            // We want the latest INITIAL_BATCH_SIZE messages, so we traverse in reverse
            const latestMessages = await messagingDB.getAllByIndex<any>(
                "messages",
                "conversation_timestamp",
                IDBKeyRange.bound([cid, 0], [cid, Date.now()]),
                INITIAL_BATCH_SIZE,
                "prev"
            );

            // Cursor direction 'prev' returns newest first, so reverse to maintain chronological order
            const mapped: Message[] = latestMessages.reverse().map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestampMs)
            }));

            setMessages(mapped);
            setHasEarlier(mapped.length >= INITIAL_BATCH_SIZE);
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!conversationId) return;
        hydrateHistory(conversationId);
    }, [conversationId, hydrateHistory]);

    // Handle incoming real-time messages
    useEffect(() => {
        if (!conversationId) return;

        const unsubscribe = messageBus.subscribe((event: MessageBusEvent) => {
            if (event.type === 'new_message' && event.conversationId === conversationId) {
                setMessages(prev => {
                    if (prev.some(m => m.id === event.message.id)) return prev;
                    // For new messages, we just append (keeping chronological order)
                    return [...prev, event.message];
                });
            } else if (event.type === 'message_updated' && event.conversationId === conversationId) {
                setMessages(prev => prev.map(m => m.id === event.message.id ? event.message : m));
            } else if (event.type === 'message_deleted' && (event.conversationId === conversationId || event.conversationIdOriginal === conversationId)) {
                setMessages(prev => prev.filter(m => m.id !== event.messageId));
            }
        });

        return unsubscribe;
    }, [conversationId]);

    const loadEarlier = useCallback(async () => {
        if (!conversationId || messages.length === 0) return;

        const earliestTimestamp = messages[0].timestamp.getTime();

        try {
            // Fetch next page: messages before the current earliest one
            const earlierMessages = await messagingDB.getAllByIndex<any>(
                "messages",
                "conversation_timestamp",
                IDBKeyRange.bound([conversationId, 0], [conversationId, earliestTimestamp - 1]),
                LOAD_EARLIER_BATCH_SIZE,
                "prev"
            );

            if (earlierMessages.length > 0) {
                const mapped: Message[] = earlierMessages.reverse().map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestampMs)
                }));

                setMessages(prev => [...mapped, ...prev]);
                setHasEarlier(mapped.length >= LOAD_EARLIER_BATCH_SIZE);
            } else {
                setHasEarlier(false);
            }
        } catch (e) {
            console.error("[useConversationMessages] Failed to load earlier messages:", e);
        }
    }, [conversationId, messages]);

    return {
        messages,
        isLoading,
        hasEarlier,
        loadEarlier
    };
}
