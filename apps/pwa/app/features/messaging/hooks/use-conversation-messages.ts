"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messagingDB } from "@dweb/storage/indexed-db";
import { messageBus, type MessageBusEvent } from "../services/message-bus";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";

interface UseConversationMessagesResult {
    messages: ReadonlyArray<Message>;
    isLoading: boolean;
    hasEarlier: boolean;
    loadEarlier: () => Promise<void>;
    pendingEventCount: number;
}

const INITIAL_BATCH_SIZE_DEFAULT = 100;
const LOAD_EARLIER_BATCH_SIZE_DEFAULT = 100;
const INITIAL_BATCH_SIZE_PERF_V2 = 60;
const LOAD_EARLIER_BATCH_SIZE_PERF_V2 = 60;
const LIVE_WINDOW_SOFT_LIMIT = 120;
const DELETE_TOMBSTONE_TTL_MS = 2 * 60 * 1000;
type DeleteTombstones = Map<string, number>;
const EMPTY_PROJECTION_MESSAGES: ReadonlyArray<Message> = [];

const getInitialBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? INITIAL_BATCH_SIZE_PERF_V2 : INITIAL_BATCH_SIZE_DEFAULT;

const getLoadEarlierBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? LOAD_EARLIER_BATCH_SIZE_PERF_V2 : LOAD_EARLIER_BATCH_SIZE_DEFAULT;

const normalizeMessage = (value: any): Message => ({
    ...value,
    timestamp: value.timestamp instanceof Date ? value.timestamp : new Date(value.timestampMs ?? value.timestamp)
});

export const applyBufferedEvents = (
    previous: ReadonlyArray<Message>,
    events: ReadonlyArray<MessageBusEvent>,
    chatPerformanceV2Enabled: boolean,
    allowExpandedHistory: boolean,
    tombstones?: DeleteTombstones,
    nowMs: number = Date.now()
): ReadonlyArray<Message> => {
    if (tombstones && tombstones.size > 0) {
        for (const [id, deletedAt] of tombstones.entries()) {
            if (nowMs - deletedAt > DELETE_TOMBSTONE_TTL_MS) {
                tombstones.delete(id);
            }
        }
    }

    const byId = new Map<string, Message>();
    previous.forEach((m) => {
        byId.set(m.id, m);
    });

    events.forEach((event) => {
        if (event.type === "message_deleted") {
            if (event.messageId === "all") {
                byId.clear();
                tombstones?.clear();
            } else {
                byId.delete(event.messageId);
                tombstones?.set(event.messageId, nowMs);
            }
            return;
        }

        const deletedAt = tombstones?.get(event.message.id);
        if (typeof deletedAt === "number" && (nowMs - deletedAt) <= DELETE_TOMBSTONE_TTL_MS) {
            return;
        }

        byId.set(event.message.id, normalizeMessage(event.message));
    });

    const sorted = Array.from(byId.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (chatPerformanceV2Enabled && !allowExpandedHistory && sorted.length > LIVE_WINDOW_SOFT_LIMIT) {
        return sorted.slice(-LIVE_WINDOW_SOFT_LIMIT);
    }
    return sorted;
};

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
    const accountProjectionSnapshot = useAccountProjectionSnapshot();
    const projectionReadAuthority = useMemo(() => (
        resolveProjectionReadAuthority({
            projectionSnapshot: accountProjectionSnapshot,
        })
    ), [accountProjectionSnapshot]);
    const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasEarlier, setHasEarlier] = useState(false);
    const [pendingEventCount, setPendingEventCount] = useState(0);
    const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);

    const eventQueueRef = useRef<MessageBusEvent[]>([]);
    const rafFlushRef = useRef<number | null>(null);
    const expandedHistoryRef = useRef(false);
    const messagesRef = useRef<ReadonlyArray<Message>>([]);
    const deletedTombstonesRef = useRef<DeleteTombstones>(new Map());
    const projectionMessages = useMemo(() => {
        if (!conversationId || !publicKeyHex) {
            return EMPTY_PROJECTION_MESSAGES;
        }
        return selectProjectionConversationMessages({
            projection: accountProjectionSnapshot.projection,
            conversationId,
            myPublicKeyHex: publicKeyHex as PublicKeyHex,
        });
    }, [accountProjectionSnapshot.projection, conversationId, publicKeyHex]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        const onPrivacySettingsChanged = () => {
            setChatPerformanceV2Enabled(PrivacySettingsService.getSettings().chatPerformanceV2);
        };
        if (typeof window !== "undefined") {
            window.addEventListener("privacy-settings-changed", onPrivacySettingsChanged);
            return () => window.removeEventListener("privacy-settings-changed", onPrivacySettingsChanged);
        }
        return;
    }, []);

    // Initial load from IndexedDB
    const hydrateHistory = useCallback(async (cid: string) => {
        setIsLoading(true);
        try {
            const initialBatchSize = getInitialBatchSize(chatPerformanceV2Enabled);
            // Use the new composite index [conversationId, timestampMs] for fast retrieval
            // We want the latest INITIAL_BATCH_SIZE messages, so we traverse in reverse
            const latestMessages = await messagingDB.getAllByIndex<any>(
                "messages",
                "conversation_timestamp",
                IDBKeyRange.bound([cid, 0], [cid, Date.now()]),
                initialBatchSize,
                "prev"
            );

            // Cursor direction 'prev' returns newest first, so reverse to maintain chronological order
            const mapped: Message[] = latestMessages.reverse().map((m: any) => normalizeMessage(m));

            const shouldUseProjectionFallback = (
                mapped.length === 0
                && projectionReadAuthority.useProjectionReads
                && projectionMessages.length > 0
            );
            const hydrated = shouldUseProjectionFallback
                ? projectionMessages
                : mapped;

            setMessages(hydrated);
            setHasEarlier(shouldUseProjectionFallback ? false : mapped.length >= initialBatchSize);
            expandedHistoryRef.current = false;
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [chatPerformanceV2Enabled, projectionMessages, projectionReadAuthority.useProjectionReads]);

    useEffect(() => {
        if (!conversationId) return;

        if (rafFlushRef.current !== null) {
            cancelAnimationFrame(rafFlushRef.current);
            rafFlushRef.current = null;
        }
        eventQueueRef.current = [];
        setPendingEventCount(0);
        expandedHistoryRef.current = false;
        deletedTombstonesRef.current.clear();

        hydrateHistory(conversationId);
    }, [conversationId, hydrateHistory, publicKeyHex]);

    useEffect(() => {
        if (!conversationId || !projectionReadAuthority.useProjectionReads) {
            return;
        }
        if (projectionMessages.length === 0) {
            return;
        }
        setMessages((prev) => {
            const byId = new Map<string, Message>();
            projectionMessages.forEach((message) => {
                byId.set(message.id, message);
            });
            prev.forEach((message) => {
                byId.set(message.id, message);
            });
            const merged = Array.from(byId.values()).sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
            if (merged.length === prev.length && merged.every((entry, index) => prev[index]?.id === entry.id)) {
                return prev;
            }
            return merged;
        });
        setHasEarlier(false);
    }, [conversationId, projectionMessages, projectionReadAuthority.useProjectionReads]);

    // Handle incoming real-time messages
    useEffect(() => {
        if (!conversationId) return;

        const flushEventQueue = () => {
            rafFlushRef.current = null;
            const queue = eventQueueRef.current;
            eventQueueRef.current = [];
            setPendingEventCount(0);

            if (queue.length === 0) return;
            const flushStart = performance.now();
            const dedupeProbe = new Set<string>();
            queue.forEach((event) => {
                if (event.type === "message_deleted") {
                    dedupeProbe.add(`d:${event.messageId}`);
                } else {
                    dedupeProbe.add(`m:${event.message.id}`);
                }
            });
            setMessages((prev) => applyBufferedEvents(
                prev,
                queue,
                chatPerformanceV2Enabled,
                expandedHistoryRef.current,
                deletedTombstonesRef.current,
                Date.now()
            ));
            if (performanceMonitor.isEnabled()) {
                const mergedOrDroppedCount = Math.max(0, queue.length - dedupeProbe.size);
                const flushLatencyMs = performance.now() - flushStart;
                performanceMonitor.recordBatchFlush(
                    queue.length,
                    mergedOrDroppedCount,
                    flushLatencyMs,
                    mergedOrDroppedCount
                );
                requestAnimationFrame(() => {
                    performanceMonitor.recordUIUpdateLatency(performance.now() - flushStart);
                });
            }
        };

        const scheduleFlush = () => {
            if (rafFlushRef.current !== null) return;
            rafFlushRef.current = requestAnimationFrame(flushEventQueue);
        };

        const unsubscribe = messageBus.subscribe((event: MessageBusEvent) => {
            const belongsToConversation = event.type === "message_deleted"
                ? (event.conversationId === conversationId || event.conversationIdOriginal === conversationId)
                : event.conversationId === conversationId;

            if (!belongsToConversation) return;

            if (!chatPerformanceV2Enabled) {
                setMessages((prev) => applyBufferedEvents(
                    prev,
                    [event],
                    false,
                    true,
                    deletedTombstonesRef.current,
                    Date.now()
                ));
                return;
            }

            if (performanceMonitor.isEnabled()) {
                performanceMonitor.recordMessageBusEvents(1);
            }
            eventQueueRef.current.push(event);
            setPendingEventCount(eventQueueRef.current.length);
            scheduleFlush();
        });

        return () => {
            unsubscribe();
            if (rafFlushRef.current !== null) {
                cancelAnimationFrame(rafFlushRef.current);
                rafFlushRef.current = null;
            }
            eventQueueRef.current = [];
            setPendingEventCount(0);
        };
    }, [conversationId, chatPerformanceV2Enabled]);

    const loadEarlier = useCallback(async () => {
        if (!conversationId || messages.length === 0) return;

        const earliestTimestamp = messages[0].timestamp.getTime();
        const loadEarlierBatchSize = getLoadEarlierBatchSize(chatPerformanceV2Enabled);

        try {
            // Fetch next page: messages before the current earliest one
            const earlierMessages = await messagingDB.getAllByIndex<any>(
                "messages",
                "conversation_timestamp",
                IDBKeyRange.bound([conversationId, 0], [conversationId, earliestTimestamp - 1]),
                loadEarlierBatchSize,
                "prev"
            );

            if (earlierMessages.length > 0) {
                const mapped: Message[] = earlierMessages.reverse().map((m: any) => normalizeMessage(m));

                setMessages(prev => [...mapped, ...prev]);
                setHasEarlier(mapped.length >= loadEarlierBatchSize);
                expandedHistoryRef.current = true;
            } else {
                setHasEarlier(false);
            }
        } catch (e) {
            console.error("[useConversationMessages] Failed to load earlier messages:", e);
        }
    }, [chatPerformanceV2Enabled, conversationId, messages]);

    return {
        messages,
        isLoading,
        hasEarlier,
        loadEarlier,
        pendingEventCount
    };
}
