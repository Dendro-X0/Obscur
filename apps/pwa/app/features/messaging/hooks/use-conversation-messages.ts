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
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { toDmConversationId } from "../utils/dm-conversation-id";
import { extractAttachmentsFromContent } from "../utils/logic";
import { logAppEvent } from "@/app/shared/log-app-event";

interface UseConversationMessagesResult {
    messages: ReadonlyArray<Message>;
    isLoading: boolean;
    hasEarlier: boolean;
    loadEarlier: () => Promise<void>;
    pendingEventCount: number;
}

const MESSAGE_PAGE_SIZE = 200;
const INITIAL_BATCH_SIZE_DEFAULT = MESSAGE_PAGE_SIZE;
const LOAD_EARLIER_BATCH_SIZE_DEFAULT = MESSAGE_PAGE_SIZE;
const INITIAL_BATCH_SIZE_PERF_V2 = MESSAGE_PAGE_SIZE;
const LOAD_EARLIER_BATCH_SIZE_PERF_V2 = MESSAGE_PAGE_SIZE;
const LIVE_WINDOW_SOFT_LIMIT = MESSAGE_PAGE_SIZE;
const PROJECTION_CONVERSATION_SOFT_LIMIT = MESSAGE_PAGE_SIZE * 3;
const DELETE_TOMBSTONE_TTL_MS = 2 * 60 * 1000;
type DeleteTombstones = Map<string, number>;
const EMPTY_PROJECTION_MESSAGES: ReadonlyArray<Message> = [];

const getInitialBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? INITIAL_BATCH_SIZE_PERF_V2 : INITIAL_BATCH_SIZE_DEFAULT;

const getLoadEarlierBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? LOAD_EARLIER_BATCH_SIZE_PERF_V2 : LOAD_EARLIER_BATCH_SIZE_DEFAULT;

const inferPeerFromConversationId = (params: Readonly<{
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
}>): PublicKeyHex | null => {
    const directPeer = normalizePublicKeyHex(params.conversationId.trim());
    if (directPeer && directPeer !== params.myPublicKeyHex) {
        return directPeer;
    }

    const parts = params.conversationId.split(":");
    if (parts.length !== 2) {
        return null;
    }
    const left = normalizePublicKeyHex(parts[0]);
    const right = normalizePublicKeyHex(parts[1]);
    if (!left || !right) {
        return null;
    }
    if (left === params.myPublicKeyHex && right !== params.myPublicKeyHex) {
        return right;
    }
    if (right === params.myPublicKeyHex && left !== params.myPublicKeyHex) {
        return left;
    }
    return null;
};

const normalizeMessage = (
    value: any,
    options?: Readonly<{
        conversationId?: string;
        myPublicKeyHex?: string | null;
    }>
): Message => {
    const timestamp = value.timestamp instanceof Date ? value.timestamp : new Date(value.timestampMs ?? value.timestamp);
    const myPublicKeyHex = normalizePublicKeyHex(options?.myPublicKeyHex);
    const conversationId = typeof value.conversationId === "string"
        ? value.conversationId
        : options?.conversationId;
    const inferredPeer = (myPublicKeyHex && conversationId)
        ? inferPeerFromConversationId({ conversationId, myPublicKeyHex })
        : null;
    const canonicalConversationId = (myPublicKeyHex && inferredPeer)
        ? toDmConversationId({
            myPublicKeyHex,
            peerPublicKeyHex: inferredPeer,
        }) ?? conversationId
        : conversationId;

    let senderPubkey = normalizePublicKeyHex(
        typeof value.senderPubkey === "string" ? value.senderPubkey : undefined
    ) ?? normalizePublicKeyHex(
        typeof value.pubkey === "string" ? value.pubkey : undefined
    );
    if (!senderPubkey) {
        if (value.isOutgoing === true && myPublicKeyHex) {
            senderPubkey = myPublicKeyHex;
        } else if (value.isOutgoing === false && inferredPeer) {
            senderPubkey = inferredPeer;
        }
    }

    let recipientPubkey = normalizePublicKeyHex(
        typeof value.recipientPubkey === "string" ? value.recipientPubkey : undefined
    );
    if (!recipientPubkey && myPublicKeyHex && inferredPeer) {
        recipientPubkey = value.isOutgoing === true ? inferredPeer : myPublicKeyHex;
    }

    const content = typeof value.content === "string" ? value.content : "";
    const storedAttachments = Array.isArray(value.attachments) && value.attachments.length > 0
        ? value.attachments
        : Array.isArray(value.attachment) && value.attachment.length > 0
            ? value.attachment
            : value.attachment
                ? [value.attachment]
                : [];
    const inferredAttachments = (
        storedAttachments.length === 0
        && content.length > 0
        && (content.includes("https://") || content.includes("http://") || content.includes("/uploads/"))
    )
        ? extractAttachmentsFromContent(content)
        : [];
    const attachments = storedAttachments.length > 0
        ? storedAttachments
        : inferredAttachments.length > 0
            ? inferredAttachments
            : undefined;

    return {
        ...value,
        timestamp,
        ...(senderPubkey ? { senderPubkey } : {}),
        ...(recipientPubkey ? { recipientPubkey } : {}),
        ...(canonicalConversationId ? { conversationId: canonicalConversationId } : {}),
        ...(attachments ? { attachments } : {}),
    };
};

const getMessageDirectionCounts = (
    entries: ReadonlyArray<Message>,
    myPublicKeyHex: PublicKeyHex | null,
): Readonly<{ outgoing: number; incoming: number }> => {
    let outgoing = 0;
    let incoming = 0;
    entries.forEach((entry) => {
        const senderPubkey = normalizePublicKeyHex(entry.senderPubkey);
        const isOutgoing = entry.isOutgoing === true || (!!myPublicKeyHex && senderPubkey === myPublicKeyHex);
        if (isOutgoing) {
            outgoing += 1;
        } else {
            incoming += 1;
        }
    });
    return { outgoing, incoming };
};

const toConversationIdDiagnosticLabel = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        return "unknown";
    }
    if (trimmed.length <= 20) {
        return trimmed;
    }
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-8)}`;
};

const buildDmSiblingConversationIds = (params: Readonly<{
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
}>): ReadonlyArray<string> => {
    const candidateIds = new Set<string>();
    candidateIds.add(params.conversationId);
    const inferredPeer = inferPeerFromConversationId(params);
    if (!inferredPeer) {
        return Array.from(candidateIds);
    }
    candidateIds.add(inferredPeer);
    candidateIds.add(`${params.myPublicKeyHex}:${inferredPeer}`);
    candidateIds.add(`${inferredPeer}:${params.myPublicKeyHex}`);
    const canonicalConversationId = toDmConversationId({
        myPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex: inferredPeer,
    });
    if (canonicalConversationId) {
        candidateIds.add(canonicalConversationId);
    }
  return Array.from(candidateIds);
};

const areMessagesEquivalentById = (
    left: ReadonlyArray<Message>,
    right: ReadonlyArray<Message>,
): boolean => {
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        if (left[index]?.id !== right[index]?.id) {
            return false;
        }
    }
    return true;
};

const loadConversationWindow = async (params: Readonly<{
    conversationId: string;
    limit: number;
}>): Promise<ReadonlyArray<any>> => {
    const rows = await messagingDB.getAllByIndex<any>(
        "messages",
        "conversation_timestamp",
        IDBKeyRange.bound([params.conversationId, 0], [params.conversationId, Date.now()]),
        params.limit,
        "prev"
    );
    if (!Array.isArray(rows)) {
        return [];
    }
    return rows;
};

export const applyBufferedEvents = (
    previous: ReadonlyArray<Message>,
    events: ReadonlyArray<MessageBusEvent>,
    chatPerformanceV2Enabled: boolean,
    allowExpandedHistory: boolean,
    tombstones?: DeleteTombstones,
    nowMs: number = Date.now(),
    myPublicKeyHex?: string | null,
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

        byId.set(event.message.id, normalizeMessage(event.message, {
            conversationId: event.conversationId,
            myPublicKeyHex,
        }));
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
    const projectionFallbackHydrationRef = useRef(false);
    const messagesRef = useRef<ReadonlyArray<Message>>([]);
    const deletedTombstonesRef = useRef<DeleteTombstones>(new Map());
    const projectionMessages = useMemo(() => {
        if (!conversationId || !publicKeyHex || !projectionReadAuthority.useProjectionReads) {
            return EMPTY_PROJECTION_MESSAGES;
        }
        const selected = selectProjectionConversationMessages({
            projection: accountProjectionSnapshot.projection,
            conversationId,
            myPublicKeyHex: publicKeyHex as PublicKeyHex,
            limit: PROJECTION_CONVERSATION_SOFT_LIMIT,
        });
        return selected.map((entry) => normalizeMessage(entry, {
            conversationId,
            myPublicKeyHex: publicKeyHex,
        }));
    }, [
        accountProjectionSnapshot.projection,
        conversationId,
        projectionReadAuthority.useProjectionReads,
        publicKeyHex,
    ]);

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
            // Cursor direction 'prev' returns newest first, so reverse to maintain chronological order.
            const latestMessages = await loadConversationWindow({
                conversationId: cid,
                limit: initialBatchSize,
            });
            const mapped: Message[] = latestMessages.slice().reverse().map((m: any) => normalizeMessage(m, {
                conversationId: cid,
                myPublicKeyHex: publicKeyHex,
            }));

            const shouldUseProjectionFallback = (
                mapped.length === 0
                && projectionReadAuthority.useProjectionReads
                && projectionMessages.length > 0
            );
            const hydrated = shouldUseProjectionFallback
                ? projectionMessages
                : mapped;
            const normalizedPublicKeyHex = normalizePublicKeyHex(publicKeyHex);
            const mappedDirectionCounts = getMessageDirectionCounts(mapped, normalizedPublicKeyHex);
            const projectionDirectionCounts = getMessageDirectionCounts(projectionMessages, normalizedPublicKeyHex);

            if (shouldUseProjectionFallback || (mappedDirectionCounts.outgoing === 0 && mappedDirectionCounts.incoming > 0)) {
                logAppEvent({
                    name: "messaging.conversation_hydration_diagnostics",
                    level: shouldUseProjectionFallback ? "info" : "warn",
                    scope: { feature: "messaging", action: "conversation_hydrate" },
                    context: {
                        conversationIdHint: toConversationIdDiagnosticLabel(cid),
                        indexedMessageCount: mapped.length,
                        indexedOutgoingCount: mappedDirectionCounts.outgoing,
                        indexedIncomingCount: mappedDirectionCounts.incoming,
                        projectionMessageCount: projectionMessages.length,
                        projectionOutgoingCount: projectionDirectionCounts.outgoing,
                        projectionIncomingCount: projectionDirectionCounts.incoming,
                        shouldUseProjectionFallback,
                        projectionReadAuthorityReason: projectionReadAuthority.reason,
                        criticalDriftCount: projectionReadAuthority.criticalDriftCount,
                    },
                });
            }

            if (
                normalizedPublicKeyHex
                && mappedDirectionCounts.incoming > 0
                && mappedDirectionCounts.outgoing === 0
            ) {
                const siblingConversationIds = buildDmSiblingConversationIds({
                    conversationId: cid,
                    myPublicKeyHex: normalizedPublicKeyHex,
                }).filter((candidateId) => candidateId !== cid);
                let siblingOutgoingCount = 0;
                let siblingIncomingCount = 0;
                let siblingWithOutgoingCount = 0;
                const siblingSamples: string[] = [];

                for (const siblingConversationId of siblingConversationIds) {
                    const siblingRows = await loadConversationWindow({
                        conversationId: siblingConversationId,
                        limit: initialBatchSize,
                    });
                    if (siblingRows.length === 0) {
                        continue;
                    }
                    const siblingMessages = siblingRows.slice().reverse().map((entry: any) => normalizeMessage(entry, {
                        conversationId: siblingConversationId,
                        myPublicKeyHex: normalizedPublicKeyHex,
                    }));
                    const siblingCounts = getMessageDirectionCounts(siblingMessages, normalizedPublicKeyHex);
                    siblingOutgoingCount += siblingCounts.outgoing;
                    siblingIncomingCount += siblingCounts.incoming;
                    if (siblingCounts.outgoing > 0) {
                        siblingWithOutgoingCount += 1;
                        if (siblingSamples.length < 3) {
                            siblingSamples.push(
                                `${toConversationIdDiagnosticLabel(siblingConversationId)}:${siblingCounts.outgoing}/${siblingCounts.incoming}`
                            );
                        }
                    }
                }

                if (siblingOutgoingCount > 0) {
                    logAppEvent({
                        name: "messaging.conversation_hydration_id_split_detected",
                        level: "warn",
                        scope: { feature: "messaging", action: "conversation_hydrate" },
                        context: {
                            conversationIdHint: toConversationIdDiagnosticLabel(cid),
                            indexedIncomingOnlyCount: mappedDirectionCounts.incoming,
                            siblingConversationCount: siblingConversationIds.length,
                            siblingWithOutgoingCount,
                            siblingOutgoingCount,
                            siblingIncomingCount,
                            siblingSample: siblingSamples.join(",") || null,
                            projectionReadAuthorityReason: projectionReadAuthority.reason,
                            criticalDriftCount: projectionReadAuthority.criticalDriftCount,
                        },
                    });
                }
            }

            setMessages(hydrated);
            setHasEarlier(shouldUseProjectionFallback ? false : mapped.length >= initialBatchSize);
            projectionFallbackHydrationRef.current = shouldUseProjectionFallback;
            expandedHistoryRef.current = false;
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [
        chatPerformanceV2Enabled,
        projectionMessages,
        projectionReadAuthority.useProjectionReads,
        projectionReadAuthority.reason,
        projectionReadAuthority.criticalDriftCount,
        publicKeyHex,
    ]);

    useEffect(() => {
        if (!conversationId) return;

        if (rafFlushRef.current !== null) {
            cancelAnimationFrame(rafFlushRef.current);
            rafFlushRef.current = null;
        }
        eventQueueRef.current = [];
        setPendingEventCount(0);
        expandedHistoryRef.current = false;
        projectionFallbackHydrationRef.current = false;
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
        const previousMessages = messagesRef.current;
        const byId = new Map<string, Message>();
        projectionMessages.forEach((message) => {
            byId.set(message.id, message);
        });
        previousMessages.forEach((message) => {
            byId.set(message.id, message);
        });
        const merged = Array.from(byId.values()).sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
        const shouldCapToLiveWindow = !expandedHistoryRef.current && merged.length > LIVE_WINDOW_SOFT_LIMIT;
        const nextMessages = shouldCapToLiveWindow
            ? merged.slice(-LIVE_WINDOW_SOFT_LIMIT)
            : merged;

        if (shouldCapToLiveWindow) {
            logAppEvent({
                name: "messaging.conversation_projection_merge_window_cap_applied",
                level: "warn",
                scope: { feature: "messaging", action: "conversation_projection_merge" },
                context: {
                    conversationIdHint: toConversationIdDiagnosticLabel(conversationId),
                    mergedMessageCount: merged.length,
                    cappedMessageCount: nextMessages.length,
                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                    projectionMessageCount: projectionMessages.length,
                },
            });
        }

        if (areMessagesEquivalentById(previousMessages, nextMessages)) {
            return;
        }

        setMessages(nextMessages);
        messagesRef.current = nextMessages;

        if (projectionFallbackHydrationRef.current) {
            setHasEarlier(false);
        } else if (shouldCapToLiveWindow) {
            setHasEarlier(true);
        }
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
                Date.now(),
                publicKeyHex,
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
                    Date.now(),
                    publicKeyHex,
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
                const mapped: Message[] = earlierMessages.reverse().map((m: any) => normalizeMessage(m, {
                    conversationId,
                    myPublicKeyHex: publicKeyHex,
                }));

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
