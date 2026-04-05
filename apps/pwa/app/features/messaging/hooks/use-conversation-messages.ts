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
import { parseCommandMessage } from "../utils/commands";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import {
    loadSuppressedMessageDeleteIds,
    suppressMessageDeleteTombstone,
} from "../services/message-delete-tombstone-store";

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
const MESSAGE_RETENTION_DAY_MS = 24 * 60 * 60 * 1000;
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
    const parsedCommand = parseCommandMessage(content);
    const resolvedKind: Message["kind"] = (
        value.kind === "command"
        || parsedCommand !== null
    )
        ? "command"
        : "user";
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
        kind: resolvedKind,
        timestamp,
        ...(senderPubkey ? { senderPubkey } : {}),
        ...(recipientPubkey ? { recipientPubkey } : {}),
        ...(canonicalConversationId ? { conversationId: canonicalConversationId } : {}),
        ...(attachments ? { attachments } : {}),
    };
};

const isDisplayableMessage = (message: Message): boolean => message.kind !== "command";

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

const normalizeLocalRetentionDays = (value: number | undefined): 0 | 30 | 90 => {
    if (value === 30 || value === 90) {
        return value;
    }
    return 0;
};

export const filterMessagesByLocalRetention = (
    messages: ReadonlyArray<Message>,
    retentionDays: number | undefined,
    nowMs: number = Date.now(),
): ReadonlyArray<Message> => {
    const normalizedRetentionDays = normalizeLocalRetentionDays(retentionDays);
    if (normalizedRetentionDays <= 0) {
        return messages;
    }
    const cutoffUnixMs = nowMs - (normalizedRetentionDays * MESSAGE_RETENTION_DAY_MS);
    return messages.filter((message) => {
        const timestampUnixMs = message.timestamp instanceof Date
            ? message.timestamp.getTime()
            : Number.NaN;
        return Number.isFinite(timestampUnixMs) && timestampUnixMs >= cutoffUnixMs;
    });
};

const loadConversationWindow = async (params: Readonly<{
    conversationId: string;
    limit: number;
    beforeTimestampMs?: number;
}>): Promise<ReadonlyArray<any>> => {
    const upperTimestampMs = typeof params.beforeTimestampMs === "number"
        ? Math.max(0, params.beforeTimestampMs - 1)
        : Date.now();
    const rows = await messagingDB.getAllByIndex<any>(
        "messages",
        "conversation_timestamp",
        IDBKeyRange.bound([params.conversationId, 0], [params.conversationId, upperTimestampMs]),
        params.limit,
        "prev"
    );
    if (!Array.isArray(rows)) {
        return [];
    }
    return rows;
};

const toRowTimestampMs = (row: any): number => {
    const timestampMs = Number(row?.timestampMs ?? (row?.timestamp instanceof Date ? row.timestamp.getTime() : row?.timestamp));
    if (Number.isFinite(timestampMs)) {
        return timestampMs;
    }
    return 0;
};

const mergeConversationRows = (params: Readonly<{
    rowsByConversationId: ReadonlyArray<Readonly<{ conversationId: string; rows: ReadonlyArray<any> }>>;
    limit: number;
}>): Readonly<{ rows: ReadonlyArray<any>; hasEarlier: boolean }> => {
    const byMessageKey = new Map<string, any>();
    let hasEarlier = false;

    params.rowsByConversationId.forEach(({ rows }) => {
        if (rows.length >= params.limit) {
            hasEarlier = true;
        }
        rows.forEach((row) => {
            const messageId = typeof row?.id === "string" ? row.id : "";
            const eventId = typeof row?.eventId === "string" ? row.eventId : "";
            const dedupeKey = eventId || messageId || `${toRowTimestampMs(row)}:${JSON.stringify(row?.content ?? "")}`;
            const existing = byMessageKey.get(dedupeKey);
            if (!existing || toRowTimestampMs(row) >= toRowTimestampMs(existing)) {
                byMessageKey.set(dedupeKey, row);
            }
        });
    });

    const newestFirst = Array.from(byMessageKey.values()).sort((left, right) => toRowTimestampMs(right) - toRowTimestampMs(left));
    if (newestFirst.length > params.limit) {
        hasEarlier = true;
    }
    return {
        rows: newestFirst.slice(0, params.limit),
        hasEarlier,
    };
};

const loadConversationWindowAcrossAliases = async (params: Readonly<{
    conversationIds: ReadonlyArray<string>;
    limit: number;
    beforeTimestampMs?: number;
}>): Promise<Readonly<{ rows: ReadonlyArray<any>; hasEarlier: boolean }>> => {
    const conversationIds = Array.from(new Set(
        params.conversationIds
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
    ));
    if (conversationIds.length === 0) {
        return { rows: [], hasEarlier: false };
    }

    const rowsByConversationId = await Promise.all(conversationIds.map(async (conversationId) => ({
        conversationId,
        rows: await loadConversationWindow({
            conversationId,
            limit: params.limit,
            beforeTimestampMs: params.beforeTimestampMs,
        }),
    })));

    return mergeConversationRows({
        rowsByConversationId,
        limit: params.limit,
    });
};

const scanDisplayableHistoryWindow = async (params: Readonly<{
    conversationIds: ReadonlyArray<string>;
    initialRows: ReadonlyArray<any>;
    initialHasEarlier: boolean;
    limit: number;
    mapRows: (rows: ReadonlyArray<any>) => ReadonlyArray<Message>;
}>): Promise<Readonly<{ messages: ReadonlyArray<Message>; hasEarlier: boolean }>> => {
    let collectedRows = [...params.initialRows];
    let hasEarlier = params.initialHasEarlier;
    let mappedMessages = params.mapRows(collectedRows);
    let passCount = 0;

    while (mappedMessages.length === 0 && hasEarlier && passCount < 4) {
        passCount += 1;
        const oldestRow = collectedRows[collectedRows.length - 1];
        const beforeTimestampMs = toRowTimestampMs(oldestRow);
        if (beforeTimestampMs <= 0) {
            break;
        }
        const earlierWindow = await loadConversationWindowAcrossAliases({
            conversationIds: params.conversationIds,
            limit: params.limit,
            beforeTimestampMs,
        });
        if (earlierWindow.rows.length === 0) {
            hasEarlier = false;
            break;
        }
        collectedRows = [...collectedRows, ...earlierWindow.rows];
        hasEarlier = earlierWindow.hasEarlier;
        mappedMessages = params.mapRows(collectedRows);
    }

    return {
        messages: mappedMessages,
        hasEarlier,
    };
};

const dedupeMessagesByIdentity = (messages: ReadonlyArray<Message>): ReadonlyArray<Message> => {
    const byMessageKey = new Map<string, Message>();
    messages.forEach((message) => {
        const dedupeKey = message.eventId?.trim() || message.id;
        const existing = byMessageKey.get(dedupeKey);
        if (!existing || message.timestamp.getTime() >= existing.timestamp.getTime()) {
            byMessageKey.set(dedupeKey, message);
        }
    });
    return Array.from(byMessageKey.values()).sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

export const applyBufferedEvents = (
    previous: ReadonlyArray<Message>,
    events: ReadonlyArray<MessageBusEvent>,
    chatPerformanceV2Enabled: boolean,
    allowExpandedHistory: boolean,
    tombstones?: DeleteTombstones,
    nowMs: number = Date.now(),
    myPublicKeyHex?: string | null,
    persistentSuppressedMessageIds?: ReadonlySet<string>,
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

        if (event.message.kind === "command") {
            byId.delete(event.message.id);
            return;
        }

        const deletedAt = tombstones?.get(event.message.id);
        if (typeof deletedAt === "number" && (nowMs - deletedAt) <= DELETE_TOMBSTONE_TTL_MS) {
            return;
        }
        if (
            persistentSuppressedMessageIds?.has(event.message.id)
            || (!!event.message.eventId && persistentSuppressedMessageIds?.has(event.message.eventId))
        ) {
            return;
        }

        byId.set(event.message.id, normalizeMessage(event.message, {
            conversationId: event.conversationId,
            myPublicKeyHex,
        }));
    });

    const sorted = Array.from(byId.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const visible = sorted.filter((message) => (
        isDisplayableMessage(message)
        && !persistentSuppressedMessageIds?.has(message.id)
        && !(message.eventId && persistentSuppressedMessageIds?.has(message.eventId))
    ));
    if (chatPerformanceV2Enabled && !allowExpandedHistory && visible.length > LIVE_WINDOW_SOFT_LIMIT) {
        return visible.slice(-LIVE_WINDOW_SOFT_LIMIT);
    }
    return visible;
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
    const activeProfileId = getActiveProfileIdSafe();
    const projectionReadAuthority = useMemo(() => (
        resolveProjectionReadAuthority({
            projectionSnapshot: accountProjectionSnapshot,
            expectedProfileId: activeProfileId,
            expectedAccountPublicKeyHex: publicKeyHex,
        })
    ), [accountProjectionSnapshot, activeProfileId, publicKeyHex]);
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
    const deletedTombstonesRef = useRef<DeleteTombstones>(new Map());
    const persistedDeletedIdsRef = useRef<Set<string>>(new Set(loadSuppressedMessageDeleteIds()));
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
        const normalized = selected.map((entry) => normalizeMessage(entry, {
            conversationId,
            myPublicKeyHex: publicKeyHex,
        })).filter((message) => (
            !persistedDeletedIdsRef.current.has(message.id)
            && !(message.eventId && persistedDeletedIdsRef.current.has(message.eventId))
        ));
        return filterMessagesByLocalRetention(normalized, localMessageRetentionDays);
    }, [
        accountProjectionSnapshot.projection,
        conversationId,
        localMessageRetentionDays,
        projectionReadAuthority.useProjectionReads,
        publicKeyHex,
    ]);
    const projectionMessagesRef = useRef<ReadonlyArray<Message>>(EMPTY_PROJECTION_MESSAGES);
    const projectionReadAuthorityRef = useRef(projectionReadAuthority);

    useEffect(() => {
        projectionMessagesRef.current = projectionMessages;
    }, [projectionMessages]);

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

    // Initial load from IndexedDB
    const hydrateHistory = useCallback(async (cid: string, conversationIds: ReadonlyArray<string>) => {
        setIsLoading(true);
        try {
            const initialBatchSize = getInitialBatchSize(chatPerformanceV2Enabled);
            const latestWindow = await loadConversationWindowAcrossAliases({
                conversationIds,
                limit: initialBatchSize,
            });
            const mapRowsToDisplayableMessages = (rows: ReadonlyArray<any>): ReadonlyArray<Message> => {
                const mapped: Message[] = rows.slice().reverse().map((m: any) => normalizeMessage(m, {
                    conversationId: typeof m?.conversationId === "string" ? m.conversationId : cid,
                    myPublicKeyHex: publicKeyHex,
                })).filter((message) => (
                    !persistedDeletedIdsRef.current.has(message.id)
                    && !(message.eventId && persistedDeletedIdsRef.current.has(message.eventId))
                ));
                const retentionFilteredMapped = filterMessagesByLocalRetention(
                    dedupeMessagesByIdentity(mapped),
                    localMessageRetentionDays,
                );
                return retentionFilteredMapped.filter(isDisplayableMessage);
            };

            const scannedWindow = await scanDisplayableHistoryWindow({
                conversationIds,
                initialRows: latestWindow.rows,
                initialHasEarlier: latestWindow.hasEarlier,
                limit: initialBatchSize,
                mapRows: mapRowsToDisplayableMessages,
            });
            const retentionFilteredMapped = scannedWindow.messages;
            const projectionMessagesSnapshot = projectionMessagesRef.current;
            const projectionReadAuthoritySnapshot = projectionReadAuthorityRef.current;

            const shouldUseProjectionFallback = (
                retentionFilteredMapped.length === 0
                && projectionReadAuthoritySnapshot.useProjectionReads
                && projectionMessagesSnapshot.length > 0
            );
            const hydrated = shouldUseProjectionFallback
                ? projectionMessagesSnapshot
                : retentionFilteredMapped;
            const mappedDirectionCounts = getMessageDirectionCounts(retentionFilteredMapped, normalizedPublicKeyHex);
            const projectionDirectionCounts = getMessageDirectionCounts(projectionMessagesSnapshot, normalizedPublicKeyHex);

            if (shouldUseProjectionFallback || (mappedDirectionCounts.outgoing === 0 && mappedDirectionCounts.incoming > 0)) {
                logAppEvent({
                    name: "messaging.conversation_hydration_diagnostics",
                    level: shouldUseProjectionFallback ? "info" : "warn",
                    scope: { feature: "messaging", action: "conversation_hydrate" },
                    context: {
                        conversationIdHint: toConversationIdDiagnosticLabel(cid),
                        indexedMessageCount: retentionFilteredMapped.length,
                        indexedOutgoingCount: mappedDirectionCounts.outgoing,
                        indexedIncomingCount: mappedDirectionCounts.incoming,
                        projectionMessageCount: projectionMessagesSnapshot.length,
                        projectionOutgoingCount: projectionDirectionCounts.outgoing,
                        projectionIncomingCount: projectionDirectionCounts.incoming,
                        shouldUseProjectionFallback,
                        projectionReadAuthorityReason: projectionReadAuthoritySnapshot.reason,
                        criticalDriftCount: projectionReadAuthoritySnapshot.criticalDriftCount,
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
                            projectionReadAuthorityReason: projectionReadAuthoritySnapshot.reason,
                            criticalDriftCount: projectionReadAuthoritySnapshot.criticalDriftCount,
                        },
                    });
                }
            }

            setMessages(hydrated);
            setHasEarlier(shouldUseProjectionFallback ? false : (scannedWindow.hasEarlier && retentionFilteredMapped.length > 0));
            projectionFallbackHydrationRef.current = shouldUseProjectionFallback;
            expandedHistoryRef.current = false;
        } catch (e) {
            console.error("[useConversationMessages] Failed to hydrate history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [
        chatPerformanceV2Enabled,
        localMessageRetentionDays,
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
        persistedDeletedIdsRef.current = new Set(loadSuppressedMessageDeleteIds());

        hydrateHistory(conversationId, conversationAliasIds);
    }, [conversationAliasIds, conversationId, hydrateHistory, publicKeyHex]);

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
        const merged = Array.from(byId.values())
            .filter((message) => (
                !persistedDeletedIdsRef.current.has(message.id)
                && !(message.eventId && persistedDeletedIdsRef.current.has(message.eventId))
            ))
            .filter(isDisplayableMessage)
            .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
        const shouldCapToLiveWindow = !expandedHistoryRef.current && merged.length > LIVE_WINDOW_SOFT_LIMIT;
        const nextMessages = shouldCapToLiveWindow
            ? merged.slice(-LIVE_WINDOW_SOFT_LIMIT)
            : merged;
        const retentionFilteredNextMessages = filterMessagesByLocalRetention(nextMessages, localMessageRetentionDays);

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

        if (areMessagesEquivalentById(previousMessages, retentionFilteredNextMessages)) {
            return;
        }

        setMessages(retentionFilteredNextMessages);
        messagesRef.current = retentionFilteredNextMessages;

        if (projectionFallbackHydrationRef.current) {
            setHasEarlier(false);
        } else if (shouldCapToLiveWindow) {
            setHasEarlier(true);
        }
    }, [conversationId, localMessageRetentionDays, projectionMessages, projectionReadAuthority.useProjectionReads]);

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
                applyBufferedEvents(
                    prev,
                    queue,
                    chatPerformanceV2Enabled,
                    expandedHistoryRef.current,
                    deletedTombstonesRef.current,
                    Date.now(),
                    publicKeyHex,
                    persistedDeletedIdsRef.current,
                ),
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

            if (event.type === "message_deleted" && event.messageId !== "all") {
                const nowMs = Date.now();
                deletedTombstonesRef.current.set(event.messageId, nowMs);
                persistedDeletedIdsRef.current.add(event.messageId);
                suppressMessageDeleteTombstone(event.messageId, nowMs);
            }

            if (!chatPerformanceV2Enabled) {
                setMessages((prev) => filterMessagesByLocalRetention(
                    applyBufferedEvents(
                        prev,
                        [event],
                        false,
                        true,
                        deletedTombstonesRef.current,
                        Date.now(),
                        publicKeyHex,
                        persistedDeletedIdsRef.current,
                    ),
                    localMessageRetentionDays,
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
    }, [conversationAliasIdSet, conversationId, chatPerformanceV2Enabled, localMessageRetentionDays, publicKeyHex]);

    const loadEarlier = useCallback(async () => {
        if (!conversationId || messages.length === 0) return;

        const earliestTimestamp = messages[0].timestamp.getTime();
        const loadEarlierBatchSize = getLoadEarlierBatchSize(chatPerformanceV2Enabled);

        try {
            const earlierWindow = await loadConversationWindowAcrossAliases({
                conversationIds: conversationAliasIds,
                limit: loadEarlierBatchSize,
                beforeTimestampMs: earliestTimestamp,
            });

            if (earlierWindow.rows.length > 0) {
                const mapRowsToDisplayableMessages = (rows: ReadonlyArray<any>): ReadonlyArray<Message> => {
                    const mapped: Message[] = rows.slice().reverse().map((m: any) => normalizeMessage(m, {
                        conversationId: typeof m?.conversationId === "string" ? m.conversationId : conversationId,
                        myPublicKeyHex: publicKeyHex,
                    })).filter((message) => (
                        isDisplayableMessage(message)
                        && !persistedDeletedIdsRef.current.has(message.id)
                        && !(message.eventId && persistedDeletedIdsRef.current.has(message.eventId))
                    ));
                    return filterMessagesByLocalRetention(
                        dedupeMessagesByIdentity(mapped),
                        localMessageRetentionDays,
                    );
                };
                const scannedWindow = await scanDisplayableHistoryWindow({
                    conversationIds: conversationAliasIds,
                    initialRows: earlierWindow.rows,
                    initialHasEarlier: earlierWindow.hasEarlier,
                    limit: loadEarlierBatchSize,
                    mapRows: mapRowsToDisplayableMessages,
                });
                if (scannedWindow.messages.length === 0) {
                    setHasEarlier(scannedWindow.hasEarlier);
                    return;
                }
                setMessages(prev => dedupeMessagesByIdentity([...scannedWindow.messages, ...prev]));
                setHasEarlier(scannedWindow.hasEarlier && scannedWindow.messages.length > 0);
                expandedHistoryRef.current = true;
            } else {
                setHasEarlier(false);
            }
        } catch (e) {
            console.error("[useConversationMessages] Failed to load earlier messages:", e);
        }
    }, [chatPerformanceV2Enabled, conversationAliasIds, conversationId, localMessageRetentionDays, messages, publicKeyHex]);

    return {
        messages,
        isLoading,
        hasEarlier,
        loadEarlier,
        pendingEventCount
    };
}
