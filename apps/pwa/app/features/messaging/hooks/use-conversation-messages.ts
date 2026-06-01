"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
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
import { useOptionalProfileMessageBus, useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { subscribeChatStateReplacedDual } from "@/app/features/profiles/services/subscribe-chat-state-replaced-dual";
import { subscribeMessagesIndexRebuiltDual } from "@/app/features/profiles/services/subscribe-messages-index-rebuilt-dual";
import { subscribeSecondaryProfileDmSoftRefresh } from "@/app/features/runtime/services/secondary-profile-dm-soft-refresh";
import { chatStateStoreService, type ChatStateReplacedEventDetail } from "../services/chat-state-store";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isCommunityInviteThreadPayloadContent } from "../services/dm-community-invite-thread-payload";
import {
    augmentCommunityDmInviteThreadMessages,
    COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT,
} from "@/app/features/groups/services/community-dm-invite-pipeline";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
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
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import {
    buildHydrateSupplementalMessages,
    DM_THREAD_DIRECTION_COVERAGE_HYDRATE_MAX_ATTEMPTS,
    DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS,
    DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS,
    evaluatePartialThreadRetryPolicy,
    evaluateProjectionMergePolicy,
    evaluateStaleEmptyHydrateRetryPolicy,
    finalizeDmThreadHydrateRead,
    hasPartialDirectionCoverage,
    resolveDisplayMessagesWithCacheFallback,
    resolveInitialConversationPaint,
    shouldPersistDmThreadDisplayCache,
} from "../services/dm-thread-read-model";
import {
    readDmThreadDisplayCache,
    writeDmThreadDisplayCache,
} from "../services/dm-thread-display-cache";
import {
    cancelCoalescedConversationHydrate,
    scheduleCoalescedConversationHydrate,
} from "../services/conversation-hydrate-coordinator";
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

const loadSyncPersistedThreadSeed = (params: Readonly<{
    conversationAliasIds: ReadonlyArray<string>;
    publicKeyHex: PublicKeyHex;
    profileId: string | undefined;
    persistentSuppressedMessageIds: ReadonlySet<string>;
    localMessageRetentionDays: number | undefined;
}>): ReadonlyArray<Message> => {
    if (requiresSqlitePersistence()) {
        return [];
    }
    const persistedState = chatStateStoreService.load(params.publicKeyHex, {
        profileId: params.profileId,
    });
    if (!persistedState?.messagesByConversationId) {
        return [];
    }
    const normalizedByConversationId = fromPersistedMessagesByConversationId(
        persistedState.messagesByConversationId,
        { myPublicKeyHex: params.publicKeyHex },
    );
    const merged: Message[] = [];
    params.conversationAliasIds.forEach((aliasId) => {
        merged.push(...(normalizedByConversationId[aliasId] ?? []));
    });
    const deduped = Array.from(new Map(merged.map((message) => [message.id, message])).values());
    return [...filterMessagesByLocalRetention(
        deduped.filter((message) => (
            isDisplayableDmConversationMessage(message)
            && !isMessageIdentityInSuppressedIdSet(message, params.persistentSuppressedMessageIds)
        )),
        params.localMessageRetentionDays,
    )].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
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
    const optionalProfileBus = useOptionalProfileMessageBus();
    const optionalProfileRuntime = useOptionalProfileRuntime();
    const messageDeleteTombstones = useMemo(
        () => messagingClientOperations.messageDeleteTombstonesPort(),
        [],
    );
    const lastTombstoneMutationAtUnixMsRef = useRef(0);
    const [deleteTombstoneEpoch, setDeleteTombstoneEpoch] = useState(0);
    const [redactionGateEpoch, setRedactionGateEpoch] = useState(0);
    const activeProfileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
    const legacyChatStateHasRicherDmContent = useMemo(() => {
        if (!conversationId || !publicKeyHex) {
            return false;
        }
        // Native desktop hydrate never reads chat-state; disabling projection here only hides
        // rows that exist in projection/SQLite bus paths (e.g. outgoing community invites).
        if (requiresSqlitePersistence()) {
            return false;
        }
        if (conversationId.startsWith("community:") || conversationId.startsWith("group:") || conversationId.includes("@")) {
            return false;
        }
        const persistedState = chatStateStoreService.load(publicKeyHex as PublicKeyHex, {
            profileId: getResolvedProfileId() || undefined,
        });
        const aliasIds = buildDmSiblingConversationIds({
            conversationId,
            myPublicKeyHex: normalizePublicKeyHex(publicKeyHex) ?? (publicKeyHex as PublicKeyHex),
        });
        return aliasIds.some((aliasId) => {
            const persistedMessages = persistedState?.messagesByConversationId?.[aliasId] ?? [];
            return persistedMessages.some((message) => (
                (typeof message.content === "string" && message.content.trim().length > 0)
                || (Array.isArray(message.attachments) && message.attachments.length > 0)
            ));
        });
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
    const isDmThread = Boolean(conversationId?.trim() && !isGroupConversationId(conversationId));

    const withInviteThreadAugment = useCallback((msgs: ReadonlyArray<Message>): ReadonlyArray<Message> => {
        if (!conversationId?.trim() || !isDmThread) {
            return msgs;
        }
        return augmentCommunityDmInviteThreadMessages(
            msgs,
            conversationId.trim(),
            activeProfileId || undefined,
            normalizedPublicKeyHex,
        );
    }, [activeProfileId, conversationId, isDmThread, normalizedPublicKeyHex]);

    const eventQueueRef = useRef<MessageBusEvent[]>([]);
    const rafFlushRef = useRef<number | null>(null);
    const activeConversationIdRef = useRef<string | undefined>(undefined);
    const hydrateGenerationRef = useRef(0);
    const suppressProjectionMergeUntilHydrateRef = useRef(false);
    const expandedHistoryRef = useRef(false);
    const projectionFallbackHydrationRef = useRef(false);
    const messagesRef = useRef<ReadonlyArray<Message>>([]);
    const historyAuthorityLogKeyRef = useRef<string | null>(null);
    const staleEmptyHydrateAttemptRef = useRef(0);
    const partialHydrateAttemptRef = useRef(false);
    const directionCoverageHydrateAttemptRef = useRef(0);
    const forceIndexedHydrationRef = useRef(false);
    const isLoadingRef = useRef(false);
    const pathname = usePathname();
    const isChatRouteActive = pathname === "/";
    const wasChatRouteActiveRef = useRef(isChatRouteActive);
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
        isLoadingRef.current = isLoading;
    }, [isLoading]);

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
            messagingClientOperations.filterDmThreadMessagesBySuppression(prev, persistedDeletedIdsRef.current),
            localMessageRetentionDays,
        ));
    }, [conversationId, deleteTombstoneEpoch, localMessageRetentionDays]);

    // Initial load from IndexedDB
    const hydrateHistory = useCallback(async (
        cid: string,
        conversationIds: ReadonlyArray<string>,
        options?: Readonly<{ includeLiveOverlay?: boolean; generation?: number }>,
    ) => {
        const generation = options?.generation;
        setIsLoading(true);
        try {
            const includeLiveOverlay = options?.includeLiveOverlay !== false;
            const preferIndexedAuthority = (
                forceIndexedHydrationRef.current
                || (
                    requiresSqlitePersistence()
                    && hasPartialDirectionCoverage(messagesRef.current, normalizedPublicKeyHex)
                )
            );
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
                    maxHydrationScanPasses: preferIndexedAuthority
                        ? INITIAL_HYDRATION_MAX_SCAN_PASSES * 2
                        : INITIAL_HYDRATION_MAX_SCAN_PASSES,
                    liveWindowSoftLimit: LIVE_WINDOW_SOFT_LIMIT,
                },
                projectionMessagesSnapshot: projectionMessagesRef.current,
                projectionEvidenceMessagesSnapshot: projectionEvidenceMessagesRef.current,
                projectionReadAuthoritySnapshot: projectionReadAuthorityRef.current,
                preferIndexedAuthority,
                accountProjectionPhase: accountProjectionSnapshot.phase,
                accountProjection: accountProjectionSnapshot.projection,
                accountProjectionReady: accountProjectionSnapshot.accountProjectionReady,
                liveMessages: includeLiveOverlay ? messagesRef.current : [],
                expandedHistory: expandedHistoryRef.current,
                previousAuthorityDiagnosticKey: historyAuthorityLogKeyRef.current,
            });
            historyAuthorityLogKeyRef.current = assembled.authorityDiagnosticKey;
            const previousMessages = messagesRef.current;
            const supplementalMessages = buildHydrateSupplementalMessages(
                assembled.finalMessages,
                normalizedPublicKeyHex,
                projectionEvidenceMessagesRef.current,
            );
            const finalizeResult = finalizeDmThreadHydrateRead({
                assembledMessages: assembled.finalMessages,
                previousMessages,
                supplementalMessages,
                conversationIds,
                myPublicKeyHex: normalizedPublicKeyHex,
                directionCoverageAttempt: directionCoverageHydrateAttemptRef.current,
                maxDirectionCoverageAttempts: DM_THREAD_DIRECTION_COVERAGE_HYDRATE_MAX_ATTEMPTS,
            });
            const hydratedMessages = finalizeResult.messages;
            if (finalizeResult.directionCoveragePreserved) {
                logAppEvent({
                    name: "messaging.conversation_hydrate_direction_coverage_preserved",
                    level: "warn",
                    scope: { feature: "messaging", action: "conversation_hydrate" },
                    context: {
                        conversationIdHint: toConversationIdDiagnosticLabel(cid),
                        previousMessageCount: previousMessages.length,
                        assembledMessageCount: assembled.finalMessages.length,
                        preservedMessageCount: hydratedMessages.length,
                    },
                });
            }
            if (generation !== undefined && generation !== hydrateGenerationRef.current) {
                return;
            }
            const augmentedMessages = withInviteThreadAugment(hydratedMessages);
            setMessages(augmentedMessages);
            messagesRef.current = augmentedMessages;
            setHasEarlier(assembled.hasEarlier);
            projectionFallbackHydrationRef.current = assembled.projectionFallbackHydration;
            expandedHistoryRef.current = false;
            suppressProjectionMergeUntilHydrateRef.current = false;
            if (
                normalizedPublicKeyHex
                && !hasPartialDirectionCoverage(hydratedMessages, normalizedPublicKeyHex)
            ) {
                partialHydrateAttemptRef.current = false;
                forceIndexedHydrationRef.current = false;
            }
            if (
                finalizeResult.reconcilePolicy.shouldRetryHydrate
            ) {
                directionCoverageHydrateAttemptRef.current += 1;
                forceIndexedHydrationRef.current = finalizeResult.reconcilePolicy.forceIndexedAuthority;
                historyAuthorityLogKeyRef.current = null;
                void hydrateHistory(cid, conversationIds, {
                    includeLiveOverlay: true,
                    generation: hydrateGenerationRef.current,
                });
            }
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
            suppressProjectionMergeUntilHydrateRef.current = false;
        } finally {
            if (generation === undefined || generation === hydrateGenerationRef.current) {
                setIsLoading(false);
            }
        }
    }, [
        chatPerformanceV2Enabled,
        localMessageRetentionDays,
        messageDeleteTombstones,
        publicKeyHex,
        normalizedPublicKeyHex,
        withInviteThreadAugment,
    ]);

    const requestConversationHydrate = useCallback((
        trigger: string,
        options?: Readonly<{ onlyIfEmpty?: boolean; bypassLoadingGuard?: boolean }>,
    ) => {
        if (!conversationId || !isDmThread) {
            return;
        }
        if (!options?.bypassLoadingGuard && isLoadingRef.current) {
            return;
        }
        if (options?.onlyIfEmpty && messagesRef.current.length > 0) {
            return;
        }
        logAppEvent({
            name: "messaging.conversation_hydrate_retry",
            level: "info",
            scope: { feature: "messaging", action: "conversation_hydrate_retry" },
            context: {
                conversationIdHint: toConversationIdDiagnosticLabel(conversationId),
                trigger,
            },
        });
        const runHydrate = (): void => {
            void hydrateHistory(conversationId, conversationAliasIds, {
                includeLiveOverlay: true,
                generation: hydrateGenerationRef.current,
            });
        };
        const immediate = trigger === "chat_route_active";
        scheduleCoalescedConversationHydrate(
            activeProfileId ?? undefined,
            conversationId,
            runHydrate,
            { immediate },
        );
    }, [activeProfileId, conversationAliasIds, conversationId, hydrateHistory, isDmThread]);

    useEffect(() => {
        staleEmptyHydrateAttemptRef.current = 0;
        partialHydrateAttemptRef.current = false;
        directionCoverageHydrateAttemptRef.current = 0;
    }, [conversationId]);

    useEffect(() => {
        if (!conversationId || !isDmThread) {
            return;
        }

        const generation = hydrateGenerationRef.current + 1;
        hydrateGenerationRef.current = generation;

        const conversationChanged = activeConversationIdRef.current !== conversationId;
        activeConversationIdRef.current = conversationId;

        if (conversationChanged) {
            cancelCoalescedConversationHydrate(activeProfileId ?? undefined, conversationId);
            suppressProjectionMergeUntilHydrateRef.current = true;
            directionCoverageHydrateAttemptRef.current = 0;
            partialHydrateAttemptRef.current = false;
            forceIndexedHydrationRef.current = requiresSqlitePersistence();
            const cached = readDmThreadDisplayCache(activeProfileId ?? undefined, conversationId) ?? [];
            const initialPaint = resolveInitialConversationPaint({
                displayCache: cached,
                syncSeed: [],
                myPublicKeyHex: normalizedPublicKeyHex,
            });
            if (initialPaint.shouldPaint) {
                messagesRef.current = initialPaint.messages;
                setMessages(initialPaint.messages);
            } else {
                messagesRef.current = [];
                setMessages([]);
            }
        }

        if (rafFlushRef.current !== null) {
            cancelAnimationFrame(rafFlushRef.current);
            rafFlushRef.current = null;
        }
        eventQueueRef.current = [];
        setPendingEventCount(0);
        expandedHistoryRef.current = false;
        projectionFallbackHydrationRef.current = false;
        deletedTombstonesRef.current.clear();
        if (conversationChanged) {
            partialHydrateAttemptRef.current = false;
        }
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
            if (conversationChanged && normalizedPublicKeyHex) {
                const syncSeed = loadSyncPersistedThreadSeed({
                    conversationAliasIds,
                    publicKeyHex: normalizedPublicKeyHex,
                    profileId,
                    persistentSuppressedMessageIds: persistedDeletedIdsRef.current,
                    localMessageRetentionDays,
                });
                const cached = readDmThreadDisplayCache(activeProfileId ?? undefined, conversationId) ?? [];
                const seedPaint = resolveInitialConversationPaint({
                    displayCache: cached,
                    syncSeed,
                    myPublicKeyHex: normalizedPublicKeyHex,
                });
                if (seedPaint.shouldPaint) {
                    messagesRef.current = seedPaint.messages;
                    setMessages(seedPaint.messages);
                }
            }
            await hydrateHistory(
                conversationId,
                conversationAliasIds,
                { includeLiveOverlay: !conversationChanged, generation },
            );
        };

        void applyPersistedDeletesAndHydrate();
    }, [
        activeProfileId,
        conversationAliasIds,
        conversationId,
        hydrateHistory,
        isDmThread,
        messageDeleteTombstones,
        normalizedPublicKeyHex,
        projectionSequence,
    ]);

    useEffect(() => {
        if (!conversationId || !isDmThread) {
            return;
        }
        return subscribeMessagesIndexRebuiltDual((detail) => {
            if (detail.profileId && detail.profileId !== activeProfileId) {
                return;
            }
            requestConversationHydrate("messages_index_rebuilt");
        }, optionalProfileBus);
    }, [activeProfileId, conversationId, isDmThread, optionalProfileBus, requestConversationHydrate]);

    useEffect(() => {
        if (!conversationId || !isDmThread) {
            return;
        }
        return subscribeSecondaryProfileDmSoftRefresh((detail) => {
            if (detail.profileId !== activeProfileId) {
                return;
            }
            forceIndexedHydrationRef.current = detail.forceIndexedAuthority;
            directionCoverageHydrateAttemptRef.current = 0;
            partialHydrateAttemptRef.current = false;
            requestConversationHydrate("secondary_profile_soft_refresh", { bypassLoadingGuard: true });
        });
    }, [activeProfileId, conversationId, isDmThread, requestConversationHydrate]);

    useEffect(() => {
        const becameChatRouteActive = isChatRouteActive && !wasChatRouteActiveRef.current;
        wasChatRouteActiveRef.current = isChatRouteActive;
        if (!becameChatRouteActive || !conversationId || !isDmThread) {
            return;
        }
        requestConversationHydrate("chat_route_active");
    }, [conversationId, isChatRouteActive, isDmThread, requestConversationHydrate]);

    useEffect(() => {
        if (!conversationId || !isDmThread || isLoadingRef.current) {
            return;
        }
        if (messagesRef.current.length > 0) {
            return;
        }
        const retryPolicy = evaluateStaleEmptyHydrateRetryPolicy({
            messageCount: messagesRef.current.length,
            isLoading: isLoadingRef.current,
            projectionHasMessages: projectionMessages.length > 0,
            useProjectionReads: projectionReadAuthority.useProjectionReads,
            attempt: staleEmptyHydrateAttemptRef.current,
            maxAttempts: DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS,
            baseDelayMs: DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS,
        });
        if (!retryPolicy.shouldSchedule) {
            return;
        }
        const timer = window.setTimeout(() => {
            staleEmptyHydrateAttemptRef.current += 1;
            requestConversationHydrate("stale_empty_retry", { onlyIfEmpty: true });
        }, retryPolicy.delayMs);
        return () => window.clearTimeout(timer);
    }, [
        conversationId,
        isDmThread,
        isLoading,
        projectionMessages.length,
        projectionReadAuthority.useProjectionReads,
        requestConversationHydrate,
    ]);

    useEffect(() => {
        if (!conversationId || !isDmThread || !normalizedPublicKeyHex || isLoadingRef.current) {
            return;
        }
        if (partialHydrateAttemptRef.current) {
            return;
        }
        const partialRetryPolicy = evaluatePartialThreadRetryPolicy({
            messages: messagesRef.current,
            myPublicKeyHex: normalizedPublicKeyHex,
            isLoading: isLoadingRef.current,
            alreadyAttempted: partialHydrateAttemptRef.current,
        });
        if (!partialRetryPolicy.shouldRetry) {
            return;
        }
        partialHydrateAttemptRef.current = true;
        forceIndexedHydrationRef.current = partialRetryPolicy.forceIndexedAuthority;
        requestConversationHydrate("partial_thread_retry", { bypassLoadingGuard: true });
    }, [
        conversationId,
        isDmThread,
        isLoading,
        messages.length,
        normalizedPublicKeyHex,
        requestConversationHydrate,
    ]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (!conversationId || !isDmThread || !normalizedPublicKeyHex) {
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
        if (!isDmThread || !conversationId || !projectionReadAuthority.useProjectionReads) {
            return;
        }
        const projectionMergePolicy = evaluateProjectionMergePolicy({
            projectionMessages,
            previousMessages: messagesRef.current,
            myPublicKeyHex: normalizedPublicKeyHex,
            suppressUntilHydrate: suppressProjectionMergeUntilHydrateRef.current,
        });
        if (!projectionMergePolicy.shouldMerge) {
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

        const augmentedNext = withInviteThreadAugment(retentionFilteredNextMessages);
        setMessages(augmentedNext);
        messagesRef.current = augmentedNext;

        if (projectionFallbackHydrationRef.current) {
            setHasEarlier(false);
        } else if (shouldCapToLiveWindow) {
            setHasEarlier(true);
        }
    }, [
        conversationAliasIdSet,
        conversationId,
        deleteTombstoneEpoch,
        localMessageRetentionDays,
        normalizedPublicKeyHex,
        projectionMessages,
        projectionReadAuthority.useProjectionReads,
        isDmThread,
    ]);

    // Handle incoming real-time messages
    useEffect(() => {
        if (!isDmThread || !conversationId) return;

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
            if (
                busEvent.type === "new_message"
                && isCommunityInviteThreadPayloadContent(busEvent.message.content)
            ) {
                const merged = withInviteThreadAugment(filterMessagesByLocalRetention(
                    messagingClientOperations.applyRealtimeBufferedEvents({
                        previous: messagesRef.current,
                        events: [busEvent],
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
                messagesRef.current = merged;
                setMessages(merged);
                if (conversationId && shouldPersistDmThreadDisplayCache(merged, publicKeyHex)) {
                    writeDmThreadDisplayCache(activeProfileId ?? undefined, conversationId, merged);
                }
                return;
            }
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
                            messagingClientOperations.filterDmThreadMessagesBySuppression(
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
                            messagingClientOperations.filterDmThreadMessagesBySuppression(
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
    }, [activeProfileId, conversationAliasIdSet, conversationId, chatPerformanceV2Enabled, isDmThread, localMessageRetentionDays, publicKeyHex, messageDeleteTombstones, withInviteThreadAugment]);

    useEffect(() => {
        if (!isDmThread || !conversationId?.trim() || typeof window === "undefined") {
            return;
        }
        const onLedgerChanged = (event: Event): void => {
            const detail = (event as CustomEvent<{ conversationId?: string; profileId?: string }>).detail;
            if (detail?.conversationId !== conversationId.trim()) {
                return;
            }
            if (detail?.profileId && detail.profileId !== activeProfileId) {
                return;
            }
            setMessages((previous) => withInviteThreadAugment(previous));
        };
        window.addEventListener(COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT, onLedgerChanged);
        return () => window.removeEventListener(COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT, onLedgerChanged);
    }, [activeProfileId, conversationId, isDmThread, withInviteThreadAugment]);

    const loadEarlier = useCallback(async () => {
        if (!isDmThread || !conversationId || messages.length === 0) return;

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
    }, [chatPerformanceV2Enabled, conversationAliasIds, conversationId, isDmThread, localMessageRetentionDays, messages, publicKeyHex]);

    useEffect(() => {
        if (!conversationId || !isDmThread || messages.length === 0) {
            return;
        }
        if (!shouldPersistDmThreadDisplayCache(messages, normalizedPublicKeyHex)) {
            return;
        }
        writeDmThreadDisplayCache(activeProfileId ?? undefined, conversationId, messages);
    }, [activeProfileId, conversationId, isDmThread, messages, normalizedPublicKeyHex]);

    const displayMessages = useMemo(() => {
        if (!isDmThread) {
            return EMPTY_PROJECTION_MESSAGES;
        }
        const withCacheFallback = resolveDisplayMessagesWithCacheFallback({
            messages,
            displayCache: readDmThreadDisplayCache(activeProfileId ?? undefined, conversationId),
            myPublicKeyHex: normalizedPublicKeyHex,
        });
        return filterMessagesThroughDmRedactionDisplayGate(withCacheFallback, activeProfileId ?? undefined);
    }, [activeProfileId, conversationId, isDmThread, messages, normalizedPublicKeyHex, redactionGateEpoch]);

    return {
        messages: displayMessages,
        isLoading: isDmThread ? isLoading : false,
        hasEarlier: isDmThread ? hasEarlier : false,
        loadEarlier,
        pendingEventCount: isDmThread ? pendingEventCount : 0,
    };
}
