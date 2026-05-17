"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { messageBus, type MessageBusEvent } from "../services/message-bus";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { resolveProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import { subscribeAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { useOptionalProfileMessageBus } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "@/app/features/profiles/services/subscribe-chat-state-replaced-dual";
import { chatStateStoreService, type ChatStateReplacedEventDetail } from "../services/chat-state-store";
import {
    filterMessagesBySuppressedIds,
    mergeHydratedBaseWithLiveOverlayMessages,
} from "../services/conversation-message-materialization";
import { isMessageIdentityInSuppressedIdSet } from "../services/conversation-message-visibility";
import { isDisplayableDmConversationMessage } from "../services/dm-conversation-displayable-message";
import { toDeletedMessageIdentityIds } from "../services/dm-conversation-delete-identity-ids";
import { expandDmDeleteIdsForThread } from "../services/expand-dm-delete-ids-for-thread";
import { messagingClientOperations } from "../services/messaging-client-operations";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import { normalizeDmConversationMessageRow } from "../services/dm-conversation-normalize-message";
import { areMessageListsEquivalentById } from "../services/dm-conversation-message-list-equiv";
import {
    filterMessagesByLocalRetention,
    normalizeLocalRetentionDays,
} from "../services/dm-conversation-message-retention-dedupe";
import { inferPeerFromConversationId, buildDmSiblingConversationIds } from "../utils/dm-conversation-sibling-ids";
import {
    applyDmRedactionDisplayGateAsync,
    filterMessagesThroughDmRedactionDisplayGate,
    subscribeDmRedactionDisplayGateChanged,
} from "../services/dm-redaction-display-gate";

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
const INITIAL_HYDRATION_VISIBLE_TARGET_DEFAULT = LIVE_WINDOW_SOFT_LIMIT;
const INITIAL_HYDRATION_MAX_SCAN_PASSES = 12;
const PROJECTION_CONVERSATION_SOFT_LIMIT = MESSAGE_PAGE_SIZE * 3;
type DeleteTombstones = Map<string, number>;
const EMPTY_PROJECTION_MESSAGES: ReadonlyArray<Message> = [];

const getInitialBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? INITIAL_BATCH_SIZE_PERF_V2 : INITIAL_BATCH_SIZE_DEFAULT;

const getLoadEarlierBatchSize = (chatPerformanceV2Enabled: boolean): number =>
    chatPerformanceV2Enabled ? LOAD_EARLIER_BATCH_SIZE_PERF_V2 : LOAD_EARLIER_BATCH_SIZE_DEFAULT;

const getInitialHydrationVisibleTarget = (): number => INITIAL_HYDRATION_VISIBLE_TARGET_DEFAULT;

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
    const optionalProfileBus = useOptionalProfileMessageBus();
    const messageDeleteTombstones = useMemo(
        () => messagingClientOperations.messageDeleteTombstonesPort(),
        [],
    );
    const lastTombstoneMutationAtUnixMsRef = useRef(0);
    const [deleteTombstoneEpoch, setDeleteTombstoneEpoch] = useState(0);
    const [redactionGateEpoch, setRedactionGateEpoch] = useState(0);
    const activeProfileId = getResolvedProfileId();
    const legacyChatStateHasRicherDmContent = useMemo(() => {
        if (!conversationId || !publicKeyHex) {
            return false;
        }
        if (conversationId.startsWith("community:") || conversationId.startsWith("group:") || conversationId.includes("@")) {
            return false;
        }
        const persistedState = chatStateStoreService.load(publicKeyHex as PublicKeyHex, {
            profileId: getResolvedProfileId() || undefined,
        });
        const persistedMessages = persistedState?.messagesByConversationId?.[conversationId] ?? [];
        return persistedMessages.some((message) => (
            (typeof message.content === "string" && message.content.trim().length > 0)
            || (Array.isArray(message.attachments) && message.attachments.length > 0)
        ));
    }, [conversationId, publicKeyHex]);
    const projectionReadAuthority = useMemo(() => (
        resolveProjectionReadAuthority({
            projectionSnapshot: accountProjectionSnapshot,
            expectedProfileId: activeProfileId,
            expectedAccountPublicKeyHex: publicKeyHex,
            legacyChatStateHasRicherDmContent,
        })
    ), [accountProjectionSnapshot, activeProfileId, legacyChatStateHasRicherDmContent, publicKeyHex]);
    const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasEarlier, setHasEarlier] = useState(false);
    const [pendingEventCount, setPendingEventCount] = useState(0);
    const [chatPerformanceV2Enabled, setChatPerformanceV2Enabled] = useState<boolean>(() => PrivacySettingsService.getSettings().chatPerformanceV2);
    const [localMessageRetentionDays, setLocalMessageRetentionDays] = useState<0 | 30 | 90>(() => (
        normalizeLocalRetentionDays(PrivacySettingsService.getSettings().localMessageRetentionDays)
    ));
    const normalizedPublicKeyHex = useMemo(() => (
        normalizePublicKeyHex(publicKeyHex)
    ), [publicKeyHex]);
    const conversationAliasIds = useMemo(() => {
        if (!conversationId) {
            return [] as ReadonlyArray<string>;
        }
        if (!normalizedPublicKeyHex) {
            return [conversationId] as ReadonlyArray<string>;
        }
        return buildDmSiblingConversationIds({
            conversationId,
            myPublicKeyHex: normalizedPublicKeyHex,
        });
    }, [conversationId, normalizedPublicKeyHex]);
    const conversationAliasIdSet = useMemo(() => (
        new Set(conversationAliasIds)
    ), [conversationAliasIds]);

    const eventQueueRef = useRef<MessageBusEvent[]>([]);
    const rafFlushRef = useRef<number | null>(null);
    const expandedHistoryRef = useRef(false);
    const projectionFallbackHydrationRef = useRef(false);
    const messagesRef = useRef<ReadonlyArray<Message>>([]);
    const historyAuthorityLogKeyRef = useRef<string | null>(null);
    const deletedTombstonesRef = useRef<DeleteTombstones>(new Map());
    const persistedDeletedIdsRef = useRef<Set<string>>(new Set(
        messagingClientOperations.loadDmSuppressedIdentityIds(getResolvedProfileId() || undefined),
    ));
    const projectionSequence = accountProjectionSnapshot.projection?.lastSequence ?? 0;
    const projectionEvidenceMessages = useMemo(() => (
        messagingClientOperations.buildProjectionEvidenceMessages({
            conversationId,
            publicKeyHex,
            projection: accountProjectionSnapshot.projection,
            limit: PROJECTION_CONVERSATION_SOFT_LIMIT,
            persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
            localMessageRetentionDays,
            normalizeRow: (entry) => normalizeDmConversationMessageRow(entry, {
                conversationId: conversationId ?? "",
            myPublicKeyHex: publicKeyHex,
            }),
        })
    ), [
        accountProjectionSnapshot.projection,
        conversationId,
        deleteTombstoneEpoch,
        localMessageRetentionDays,
        projectionSequence,
        publicKeyHex,
    ]);
    const projectionMessages = useMemo(() => (
        projectionReadAuthority.useProjectionReads
            ? projectionEvidenceMessages
            : EMPTY_PROJECTION_MESSAGES
    ), [projectionEvidenceMessages, projectionReadAuthority.useProjectionReads]);
    const projectionMessagesRef = useRef<ReadonlyArray<Message>>(EMPTY_PROJECTION_MESSAGES);
    const projectionEvidenceMessagesRef = useRef<ReadonlyArray<Message>>(EMPTY_PROJECTION_MESSAGES);
    const projectionReadAuthorityRef = useRef(projectionReadAuthority);

    useEffect(() => {
        projectionMessagesRef.current = projectionMessages;
    }, [projectionMessages]);

    useEffect(() => {
        projectionEvidenceMessagesRef.current = projectionEvidenceMessages;
    }, [projectionEvidenceMessages]);

    useEffect(() => {
        projectionReadAuthorityRef.current = projectionReadAuthority;
    }, [projectionReadAuthority]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        setMessages((previousMessages) => filterMessagesByLocalRetention(previousMessages, localMessageRetentionDays));
    }, [localMessageRetentionDays]);

    useEffect(() => {
        const onPrivacySettingsChanged = () => {
            const settings = PrivacySettingsService.getSettings();
            setChatPerformanceV2Enabled(settings.chatPerformanceV2);
            setLocalMessageRetentionDays(normalizeLocalRetentionDays(settings.localMessageRetentionDays));
        };
        if (typeof window !== "undefined") {
            window.addEventListener("privacy-settings-changed", onPrivacySettingsChanged);
            return () => window.removeEventListener("privacy-settings-changed", onPrivacySettingsChanged);
        }
        return;
    }, []);

    useEffect(() => {
        if (!conversationId || typeof window === "undefined") {
            return;
        }
        return subscribeDmRedactionDisplayGateChanged((detail) => {
            const activeProfile = getResolvedProfileId();
            if (!activeProfile || detail.profileId !== activeProfile) {
                return;
            }
            if (
                conversationAliasIdSet.has(detail.conversationId)
                || detail.conversationId === conversationId
            ) {
                setRedactionGateEpoch((epoch) => epoch + 1);
            }
        });
    }, [conversationAliasIdSet, conversationId]);

    useEffect(() => {
        if (!conversationId || typeof window === "undefined") {
            return;
        }
        return subscribeAccountSyncMutation((detail) => {
            if (detail.reason !== "message_delete_tombstones_changed") {
                return;
            }
            if (detail.atUnixMs <= lastTombstoneMutationAtUnixMsRef.current) {
                return;
            }
            lastTombstoneMutationAtUnixMsRef.current = detail.atUnixMs;
            void (async () => {
                const profileId = activeProfileId || undefined;
                persistedDeletedIdsRef.current = await messagingClientOperations.prepareDmThreadSuppressionIds({
                    profileId,
                    accountPublicKeyHex: normalizedPublicKeyHex,
                    projection: accountProjectionRuntime.getSnapshot().projection,
                    messageDeleteTombstones,
                    seedIds: persistedDeletedIdsRef.current,
                });
                setDeleteTombstoneEpoch((epoch) => epoch + 1);
            })();
        }, { profileId: activeProfileId, replayOnSubscribe: false });
    }, [activeProfileId, conversationId, messageDeleteTombstones, normalizedPublicKeyHex]);

    useEffect(() => {
        if (!conversationId || deleteTombstoneEpoch === 0) {
            return;
        }
        setMessages((prev) => filterMessagesByLocalRetention(
            filterMessagesBySuppressedIds(prev, persistedDeletedIdsRef.current),
            localMessageRetentionDays,
        ));
    }, [conversationId, deleteTombstoneEpoch, localMessageRetentionDays]);

    // Initial load from IndexedDB
    const hydrateHistory = useCallback(async (cid: string, conversationIds: ReadonlyArray<string>) => {
        setIsLoading(true);
        try {
            const assembled = await messagingClientOperations.hydrateDmThreadReadModel({
                conversationId: cid,
                conversationIds,
                profileIdForTombstones: getResolvedProfileId() || undefined,
                messageDeleteTombstones,
                persistedDeletedIds: persistedDeletedIdsRef.current,
                publicKeyHex,
                normalizedPublicKeyHex,
                localMessageRetentionDays,
                numeric: {
                    initialBatchSize: getInitialBatchSize(chatPerformanceV2Enabled),
                    initialHydrationVisibleTarget: getInitialHydrationVisibleTarget(),
                    maxHydrationScanPasses: INITIAL_HYDRATION_MAX_SCAN_PASSES,
                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                },
                projectionMessagesSnapshot: projectionMessagesRef.current,
                projectionEvidenceMessagesSnapshot: projectionEvidenceMessagesRef.current,
                projectionReadAuthoritySnapshot: projectionReadAuthorityRef.current,
                accountProjectionPhase: accountProjectionSnapshot.phase,
                accountProjection: accountProjectionSnapshot.projection,
                accountProjectionReady: accountProjectionSnapshot.accountProjectionReady,
                liveMessages: messagesRef.current,
                expandedHistory: expandedHistoryRef.current,
                previousAuthorityDiagnosticKey: historyAuthorityLogKeyRef.current,
            });
            historyAuthorityLogKeyRef.current = assembled.authorityDiagnosticKey;
            setMessages(assembled.finalMessages);
            setHasEarlier(assembled.hasEarlier);
            projectionFallbackHydrationRef.current = assembled.projectionFallbackHydration;
            expandedHistoryRef.current = false;
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [
        chatPerformanceV2Enabled,
        localMessageRetentionDays,
        messageDeleteTombstones,
        publicKeyHex,
        normalizedPublicKeyHex,
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
        // Union semantics: keep any in-memory deleted IDs already in the ref,
        // then add the durable persisted set. This prevents losing Tauri delete
        // state which is held only in-memory until SQLite commits.
        const profileId = getResolvedProfileId() || undefined;
        const applyPersistedDeletesAndHydrate = async (): Promise<void> => {
            persistedDeletedIdsRef.current = await messagingClientOperations.prepareDmThreadSuppressionIds({
                profileId,
                accountPublicKeyHex: normalizedPublicKeyHex,
                projection: accountProjectionSnapshot.projection,
                messageDeleteTombstones,
                seedIds: persistedDeletedIdsRef.current,
            });
        historyAuthorityLogKeyRef.current = null;
            await hydrateHistory(conversationId, conversationAliasIds);
        };

        void applyPersistedDeletesAndHydrate();
    }, [
        conversationAliasIds,
        conversationId,
        hydrateHistory,
        messageDeleteTombstones,
        normalizedPublicKeyHex,
        projectionSequence,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (!conversationId || !normalizedPublicKeyHex) {
            return;
        }
        return subscribeChatStateReplacedDual((detail) => {
            const restoredPublicKeyHex = normalizePublicKeyHex(detail?.publicKeyHex);
            if (restoredPublicKeyHex && restoredPublicKeyHex !== normalizedPublicKeyHex) {
                return;
            }
            if (detail?.profileId && detail.profileId !== getResolvedProfileId()) {
                return;
            }

            // DO NOT clear eventQueueRef or reset expandedHistoryRef before calling
            // hydrateHistory — the hydrateHistory merge logic will union with messagesRef.current
            // so in-flight messages survive the restore cycle. Only reset tombstone state
            // because those are correctness-critical (deleted messages must stay gone).
            //
            // Union semantics: start with whatever is already in the ref (in-memory deletes
            // written since the last hydrateHistory), then add the durable persisted set.
            // On Tauri, loadSuppressedMessageDeleteIds is always empty (the localStorage store
            // is a no-op on Tauri), so we must NOT discard the existing ref contents — they
            // are the only in-process record of deletes that may not yet be committed to SQLite.
            deletedTombstonesRef.current.clear();
            historyAuthorityLogKeyRef.current = null;

            void (async () => {
                persistedDeletedIdsRef.current = await messagingClientOperations.prepareDmThreadSuppressionIds({
                    profileId: getResolvedProfileId() || undefined,
                    accountPublicKeyHex: normalizedPublicKeyHex,
                    projection: accountProjectionSnapshot.projection,
                    messageDeleteTombstones,
                    seedIds: persistedDeletedIdsRef.current,
                });
                await hydrateHistory(conversationId, conversationAliasIds);
            })();
        }, optionalProfileBus);
    }, [
        conversationAliasIds,
        conversationId,
        hydrateHistory,
        messageDeleteTombstones,
        normalizedPublicKeyHex,
        optionalProfileBus,
        projectionSequence,
    ]);

    useEffect(() => {
        if (!conversationId || !projectionReadAuthority.useProjectionReads) {
            return;
        }
        if (projectionMessages.length === 0) {
            return;
        }
        const previousMessages = messagesRef.current;
        const mergeResult = messagingClientOperations.mergeProjectionWithLiveOverlay({
            projectionMessages,
            previousMessages,
            conversationAliasIdSet,
            persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
            localMessageRetentionDays,
            expandedHistory: expandedHistoryRef.current,
            liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
            isDisplayable: isDisplayableDmConversationMessage,
        });
        const { retentionFilteredNextMessages, shouldCapToLiveWindow, mergedMessageCount, cappedMessageCount } = mergeResult;

        if (shouldCapToLiveWindow) {
            logAppEvent({
                name: "messaging.conversation_projection_merge_window_cap_applied",
                level: "warn",
                scope: { feature: "messaging", action: "conversation_projection_merge" },
                context: {
                    conversationIdHint: toConversationIdDiagnosticLabel(conversationId),
                    mergedMessageCount,
                    cappedMessageCount,
                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                    projectionMessageCount: projectionMessages.length,
                },
            });
        }

        if (areMessageListsEquivalentById(previousMessages, retentionFilteredNextMessages)) {
            return;
        }

        setMessages(retentionFilteredNextMessages);
        messagesRef.current = retentionFilteredNextMessages;

        if (projectionFallbackHydrationRef.current) {
            setHasEarlier(false);
        } else if (shouldCapToLiveWindow) {
            setHasEarlier(true);
        }
    }, [conversationAliasIdSet, conversationId, deleteTombstoneEpoch, localMessageRetentionDays, projectionMessages, projectionReadAuthority.useProjectionReads]);

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
            setMessages((prev) => filterMessagesByLocalRetention(
                messagingClientOperations.applyRealtimeBufferedEvents({
                    previous: prev,
                    events: queue,
                    chatPerformanceV2Enabled,
                    allowExpandedHistory: expandedHistoryRef.current,
                    tombstones: deletedTombstonesRef.current,
                    nowMs: Date.now(),
                    myPublicKeyHex: publicKeyHex,
                    persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                }),
                localMessageRetentionDays,
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
                ? (
                    conversationAliasIdSet.has(event.conversationId)
                    || (!!event.conversationIdOriginal && conversationAliasIdSet.has(event.conversationIdOriginal))
                )
                : conversationAliasIdSet.has(event.conversationId);

            if (!belongsToConversation) return;

            const busEvent: MessageBusEvent = event;
            if (event.type === "message_deleted" && event.messageId !== "all") {
                if (!conversationId) {
                    return;
                }
                if (!normalizedPublicKeyHex) {
                    const deleteIds = toDeletedMessageIdentityIds(event);
                    const nowMs = Date.now();
                    deleteIds.forEach((deleteId) => {
                        deletedTombstonesRef.current.set(deleteId, nowMs);
                        persistedDeletedIdsRef.current.add(deleteId);
                    });
                    const resolvedBusEvent: MessageBusEvent = {
                        ...event,
                        messageIdentityIds: deleteIds,
                    };
                    if (!chatPerformanceV2Enabled) {
                        setMessages((prev) => filterMessagesByLocalRetention(
                            filterMessagesBySuppressedIds(
                                messagingClientOperations.applyRealtimeBufferedEvents({
                                    previous: prev,
                                    events: [resolvedBusEvent],
                                    chatPerformanceV2Enabled: false,
                                    allowExpandedHistory: true,
                                    tombstones: deletedTombstonesRef.current,
                                    nowMs,
                                    myPublicKeyHex: publicKeyHex,
                                    persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                                }),
                                persistedDeletedIdsRef.current,
                            ),
                            localMessageRetentionDays,
                        ));
                        return;
                    }
                    if (performanceMonitor.isEnabled()) {
                        performanceMonitor.recordMessageBusEvents(1);
                    }
                    eventQueueRef.current.push(resolvedBusEvent);
                    setPendingEventCount(eventQueueRef.current.length);
                    scheduleFlush();
                    return;
                }
                void (async () => {
                const nowMs = Date.now();
                const deleteIds = toDeletedMessageIdentityIds(event);
                    const expandedDeleteIds = await expandDmDeleteIdsForThread({
                        conversationId: event.conversationId,
                        myPublicKeyHex: normalizedPublicKeyHex,
                        targetMessageIds: deleteIds,
                        localMessages: messagesRef.current,
                        overlayMessages: [
                            ...projectionMessagesRef.current,
                            ...projectionEvidenceMessagesRef.current,
                        ],
                    });
                    const newDeleteIds = expandedDeleteIds.filter((id) => !persistedDeletedIdsRef.current.has(id));
                    const expandedSuppressionSet = new Set(expandedDeleteIds);
                const activeProfile = getResolvedProfileId() || undefined;
                    expandedDeleteIds.forEach((deleteId) => {
                    deletedTombstonesRef.current.set(deleteId, nowMs);
                    persistedDeletedIdsRef.current.add(deleteId);
                    });
                    if (activeProfile && normalizedPublicKeyHex) {
                        await applyDmRedactionDisplayGateAsync({
                            profileId: activeProfile,
                            conversationId: event.conversationId,
                            identityIds: expandedDeleteIds,
                            myPublicKeyHex: normalizedPublicKeyHex,
                        });
                    }
                    persistedDeletedIdsRef.current = await messagingClientOperations.prepareDmThreadSuppressionIds({
                        profileId: activeProfile,
                        accountPublicKeyHex: normalizedPublicKeyHex,
                        projection: accountProjectionRuntime.getSnapshot().projection,
                        messageDeleteTombstones,
                        seedIds: persistedDeletedIdsRef.current,
                    });
                    if (expandedDeleteIds.length > 0) {
                        setDeleteTombstoneEpoch((epoch) => epoch + 1);
                    }
                    if (projectionReadAuthorityRef.current.useProjectionReads && conversationId) {
                        const freshProjectionMessages = messagingClientOperations.buildProjectionEvidenceMessages({
                            conversationId,
                            publicKeyHex,
                            projection: accountProjectionRuntime.getSnapshot().projection,
                            limit: PROJECTION_CONVERSATION_SOFT_LIMIT,
                            persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                            localMessageRetentionDays,
                            normalizeRow: (entry) => normalizeDmConversationMessageRow(entry, {
                                conversationId,
                                myPublicKeyHex: publicKeyHex,
                            }),
                        });
                        const mergeResult = messagingClientOperations.mergeProjectionWithLiveOverlay({
                            projectionMessages: freshProjectionMessages,
                            previousMessages: messagesRef.current,
                            conversationAliasIdSet,
                            persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                            localMessageRetentionDays,
                            expandedHistory: expandedHistoryRef.current,
                            liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                            isDisplayable: isDisplayableDmConversationMessage,
                        });
                        setMessages(mergeResult.retentionFilteredNextMessages);
                        if (process.env.NODE_ENV === "development") {
                            const visibleAfter = mergeResult.retentionFilteredNextMessages.filter((message) => (
                                isMessageIdentityInSuppressedIdSet(message, expandedSuppressionSet)
                            )).length;
                            if (visibleAfter > 0) {
                                console.warn("[dm-redaction] suppressed ids still visible after projection merge", {
                                    conversationId: event.conversationId.slice(0, 32),
                                    expandedCount: expandedDeleteIds.length,
                                    visibleAfter,
                                });
                            }
                        }
                        return;
                    }
                    if (newDeleteIds.length > 0) {
                        void messagingClientOperations.recordMessageBusDeletedIdentities({
                            conversationId: event.conversationId,
                            messageIdentityIds: newDeleteIds,
                            deletedAtUnixMs: nowMs,
                            profileId: activeProfile,
                            accountPublicKeyHex: publicKeyHex ?? undefined,
                        });
                    }
                    const resolvedBusEvent: MessageBusEvent = {
                        ...event,
                        messageId: expandedDeleteIds[0] ?? event.messageId,
                        messageIdentityIds: expandedDeleteIds,
                    };
            if (!chatPerformanceV2Enabled) {
                setMessages((prev) => filterMessagesByLocalRetention(
                            filterMessagesBySuppressedIds(
                                messagingClientOperations.applyRealtimeBufferedEvents({
                                    previous: prev,
                                    events: [resolvedBusEvent],
                                    chatPerformanceV2Enabled: false,
                                    allowExpandedHistory: true,
                                    tombstones: deletedTombstonesRef.current,
                                    nowMs,
                                    myPublicKeyHex: publicKeyHex,
                                    persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                                }),
                        persistedDeletedIdsRef.current,
                    ),
                            localMessageRetentionDays,
                        ));
                        return;
                    }
                    if (performanceMonitor.isEnabled()) {
                        performanceMonitor.recordMessageBusEvents(1);
                    }
                    eventQueueRef.current.push(resolvedBusEvent);
                    setPendingEventCount(eventQueueRef.current.length);
                    scheduleFlush();
                })();
                return;
            }

            if (!chatPerformanceV2Enabled) {
                setMessages((prev) => filterMessagesByLocalRetention(
                    messagingClientOperations.applyRealtimeBufferedEvents({
                        previous: prev,
                        events: [busEvent],
                        chatPerformanceV2Enabled: false,
                        allowExpandedHistory: true,
                        tombstones: deletedTombstonesRef.current,
                        nowMs: Date.now(),
                        myPublicKeyHex: publicKeyHex,
                        persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                        liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                    }),
                    localMessageRetentionDays,
                ));
                return;
            }

            if (performanceMonitor.isEnabled()) {
                performanceMonitor.recordMessageBusEvents(1);
            }
            eventQueueRef.current.push(busEvent);
            setPendingEventCount(eventQueueRef.current.length);
            scheduleFlush();
        }, { profileId: activeProfileId });

        return () => {
            unsubscribe();
            if (rafFlushRef.current !== null) {
                cancelAnimationFrame(rafFlushRef.current);
                rafFlushRef.current = null;
            }
            eventQueueRef.current = [];
            setPendingEventCount(0);
        };
    }, [activeProfileId, conversationAliasIdSet, conversationId, chatPerformanceV2Enabled, localMessageRetentionDays, publicKeyHex, messageDeleteTombstones]);

    const loadEarlier = useCallback(async () => {
        if (!conversationId || messages.length === 0) return;

        const earliestTimestamp = messages[0].timestamp.getTime();
        const loadEarlierBatchSize = getLoadEarlierBatchSize(chatPerformanceV2Enabled);

        try {
            const result = await messagingClientOperations.loadEarlierDmMessages({
                conversationId,
                conversationAliasIds,
                earliestTimestampMs: earliestTimestamp,
                loadEarlierBatchSize,
                publicKeyHex,
                persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                        localMessageRetentionDays,
                existingMessages: messages,
            });
            setMessages(result.messages);
            setHasEarlier(result.hasEarlier);
            if (result.didExpandHistory) {
                expandedHistoryRef.current = true;
            }
        } catch (e) {
            console.error("[useConversationMessages] Failed to load earlier messages:", e);
        }
    }, [chatPerformanceV2Enabled, conversationAliasIds, conversationId, localMessageRetentionDays, messages, publicKeyHex]);

    const displayMessages = useMemo(() => (
        filterMessagesThroughDmRedactionDisplayGate(messages, activeProfileId ?? undefined)
    ), [activeProfileId, messages, redactionGateEpoch]);

    return {
        messages: displayMessages,
        isLoading,
        hasEarlier,
        loadEarlier,
        pendingEventCount
    };
}
