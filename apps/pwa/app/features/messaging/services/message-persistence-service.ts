import { messageBus, type MessageBusEvent } from "./message-bus";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message } from "../types";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import { toDmConversationId } from "../utils/dm-conversation-id";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import { isTauri, dbInsertMessage, dbInsertTombstone, dbDeleteMessages, dbUpsertConversation } from "@dweb/db";
import type { MessageRecord, TombstoneRecord, ConversationRecord } from "@dweb/db";
import type { ChatStateReplacedEventDetail } from "./chat-state-store";
import { createMicrotaskCoalescedHandler } from "@/app/features/profiles/services/profile-bus-coalesce";
import { messagingClientOperations } from "./messaging-client-operations";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";

export const MESSAGES_INDEX_REBUILT_EVENT = "obscur:messages-index-rebuilt";
export type MessagesIndexRebuiltEventDetail = Readonly<{
    publicKeyHex: string;
    profileId: string;
    messageCount: number;
}>;

export function dispatchMessagesIndexRebuiltEvent(detail: MessagesIndexRebuiltEventDetail): void {
    const scope = getProfileRuntimeScope();
    if (scope?.bus && scope.profileId === detail.profileId) {
        scope.bus.publish({
            type: "messages-index-rebuilt",
            detail,
        });
    }
}

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

const canonicalizeDmConversationId = (params: Readonly<{
    conversationId: string;
    myPublicKeyHex: PublicKeyHex;
}>): string => {
    const inferredPeer = inferPeerFromConversationId(params);
    if (!inferredPeer) {
        return params.conversationId;
    }
    return toDmConversationId({
        myPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex: inferredPeer,
    }) ?? params.conversationId;
};

const summarizeSourceDmConversationIds = (
    source: Readonly<Record<string, unknown>> | undefined,
    myPublicKeyHex: PublicKeyHex
): Readonly<{
    sourceConversationCount: number;
    canonicalConversationCount: number;
    canonicalMismatchConversationCount: number;
    canonicalCollisionCount: number;
    canonicalCollisionSample: string | null;
}> => {
    const sourceConversationIds = Object.keys(source ?? {});
    if (sourceConversationIds.length === 0) {
        return {
            sourceConversationCount: 0,
            canonicalConversationCount: 0,
            canonicalMismatchConversationCount: 0,
            canonicalCollisionCount: 0,
            canonicalCollisionSample: null,
        };
    }
    const canonicalSources = new Map<string, Set<string>>();
    let canonicalMismatchConversationCount = 0;
    sourceConversationIds.forEach((sourceConversationId) => {
        const canonicalConversationId = canonicalizeDmConversationId({
            conversationId: sourceConversationId,
            myPublicKeyHex,
        });
        if (canonicalConversationId !== sourceConversationId) {
            canonicalMismatchConversationCount += 1;
        }
        const existing = canonicalSources.get(canonicalConversationId) ?? new Set<string>();
        existing.add(sourceConversationId);
        canonicalSources.set(canonicalConversationId, existing);
    });

    const collisions = Array.from(canonicalSources.entries())
        .filter(([, sourceIds]) => sourceIds.size > 1);
    const canonicalCollisionSample = collisions.length === 0
        ? null
        : collisions.slice(0, 3).map(([canonicalConversationId, sourceIds]) => (
            `${toConversationIdDiagnosticLabel(canonicalConversationId)}<=${Array.from(sourceIds).slice(0, 3).map(toConversationIdDiagnosticLabel).join("|")}`
        )).join(",");
    return {
        sourceConversationCount: sourceConversationIds.length,
        canonicalConversationCount: canonicalSources.size,
        canonicalMismatchConversationCount,
        canonicalCollisionCount: collisions.length,
        canonicalCollisionSample,
    };
};

const summarizeMigratedMessages = (
    migratedMessages: ReadonlyArray<Record<string, unknown>>,
    myPublicKeyHex: PublicKeyHex,
): Readonly<{
    migratedConversationCount: number;
    migratedMessageCount: number;
    migratedOutgoingCount: number;
    migratedIncomingCount: number;
    incomingOnlyConversationCount: number;
}> => {
    if (migratedMessages.length === 0) {
        return {
            migratedConversationCount: 0,
            migratedMessageCount: 0,
            migratedOutgoingCount: 0,
            migratedIncomingCount: 0,
            incomingOnlyConversationCount: 0,
        };
    }
    const byConversation = new Map<string, Readonly<{ outgoing: number; incoming: number }>>();
    migratedMessages.forEach((message) => {
        const conversationId = typeof message.conversationId === "string" ? message.conversationId : "";
        if (!conversationId) {
            return;
        }
        const senderPubkey = normalizePublicKeyHex(
            typeof message.senderPubkey === "string"
                ? message.senderPubkey
                : typeof message.pubkey === "string"
                    ? message.pubkey
                    : undefined
        );
        const isOutgoing = message.isOutgoing === true || senderPubkey === myPublicKeyHex;
        const existing = byConversation.get(conversationId) ?? { outgoing: 0, incoming: 0 };
        byConversation.set(conversationId, isOutgoing
            ? { outgoing: existing.outgoing + 1, incoming: existing.incoming }
            : { outgoing: existing.outgoing, incoming: existing.incoming + 1 });
    });

    let migratedOutgoingCount = 0;
    let migratedIncomingCount = 0;
    let incomingOnlyConversationCount = 0;
    byConversation.forEach((stats) => {
        migratedOutgoingCount += stats.outgoing;
        migratedIncomingCount += stats.incoming;
        if (stats.incoming > 0 && stats.outgoing === 0) {
            incomingOnlyConversationCount += 1;
        }
    });

    return {
        migratedConversationCount: byConversation.size,
        migratedMessageCount: migratedMessages.length,
        migratedOutgoingCount,
        migratedIncomingCount,
        incomingOnlyConversationCount,
    };
};

const collectPersistedConversationIds = (dbState: Record<string, unknown>): ReadonlyArray<string> => {
    const collected: string[] = [];
    const pushIds = (value: unknown): void => {
        if (!Array.isArray(value)) {
            return;
        }
        value.forEach((entry) => {
            if (!entry || typeof entry !== "object") {
                return;
            }
            const id = (entry as { id?: unknown }).id;
            if (typeof id === "string" && id.trim().length > 0) {
                collected.push(id.trim());
            }
        });
    };
    pushIds(dbState.createdConnections);
    pushIds(dbState.createdGroups);
    return collected;
};

const hasLegacyChatTimelineDomains = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value as Readonly<{
        messagesByConversationId?: Readonly<Record<string, unknown>>;
        groupMessages?: Readonly<Record<string, unknown>>;
    }>;
    const dmConversationCount = Object.keys(candidate.messagesByConversationId ?? {}).length;
    if (dmConversationCount > 0) {
        return true;
    }
    const groupConversationCount = Object.keys(candidate.groupMessages ?? {}).length;
    return groupConversationCount > 0;
};

/**
 * MessagePersistenceService
 * 
 * listens to the MessageBus and ensures every message event is reflected 
 * in the high-performance IndexedDB 'messages' store.
 */
export class MessagePersistenceService {
    private isInitialized = false;
    private readonly flushIntervalMs = 32;
    private readonly immediateFlushThreshold = 50;
    private readonly deleteTombstoneTtlMs = 2 * 60 * 1000;
    private pendingUpserts = new Map<string, Record<string, unknown>>();
    private pendingDeletes = new Set<string>();
    private pendingSupersededIds = new Set<string>();
    private recentlyDeletedMessageIds = new Map<string, number>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private isFlushing = false;
    private batchedEventCount = 0;
    private currentBatchStartMs: number | null = null;
    private activeMessageStoreScopeKey: string | null = null;
    private static readonly MIGRATION_DONE_KEY_PREFIX = "obscur:msg_migration_done::";
    private unsubscribeMessageBus: (() => void) | null = null;
    private readonly onVisibilityChange = (): void => {
        if (typeof document === "undefined") return;
        if (document.visibilityState === "hidden") {
            void this.flushQueue();
        }
    };
    private readonly onBeforeUnload = (): void => {
        void this.flushQueue();
    };
    private chatPerformanceV2Enabled = false;
    private readonly onPrivacySettingsChanged = (): void => {
        this.chatPerformanceV2Enabled = PrivacySettingsService.getSettings().chatPerformanceV2;
    };
    private chatReplacePendingDetail: Readonly<Partial<ChatStateReplacedEventDetail>> | undefined;
    private readonly flushChatReplaceDetail = createMicrotaskCoalescedHandler((): void => {
        const detail = this.chatReplacePendingDetail;
        this.chatReplacePendingDetail = undefined;
        const restoredPublicKeyHex = normalizePublicKeyHex(detail?.publicKeyHex);
        if (!restoredPublicKeyHex) {
            return;
        }
        const restoredProfileId = typeof detail?.profileId === "string"
            ? detail.profileId.trim()
            : "";
        if (restoredProfileId.length > 0 && restoredProfileId !== getResolvedProfileId()) {
            return;
        }
        void this.migrateFromLegacy(restoredPublicKeyHex, {
            profileId: restoredProfileId || undefined,
        });
    });

    private readonly queueChatReplaceDetail = (detail: Readonly<Partial<ChatStateReplacedEventDetail>> | undefined): void => {
        this.chatReplacePendingDetail = detail;
        this.flushChatReplaceDetail();
    };

    private chatStateBusUnsubscribe: (() => void) | null = null;

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.chatPerformanceV2Enabled = PrivacySettingsService.getSettings().chatPerformanceV2;

        this.unsubscribeMessageBus = messageBus.subscribe((event: MessageBusEvent) => {
            switch (event.type) {
                case 'new_message':
                case 'message_updated':
                    if (event.message.kind === "command") {
                        break;
                    }
                    this.saveMessage(event.conversationId, event.message, event.type);
                    break;
                case 'message_deleted':
                    if (event.messageId === 'all') {
                        // Handled by chatStateStoreService.deleteConversationMessages usually,
                        // but we can also handle it here if we want absolute decoupling.
                    } else {
                        this.deleteMessage(event.messageId, event.messageIdentityIds, event.conversationId);
                    }
                    break;
            }
        }, { profileId: getResolvedProfileId() });

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this.onBeforeUnload);
            window.addEventListener("privacy-settings-changed", this.onPrivacySettingsChanged);
        }
    }

    /**
     * Chat-state replaces are observed via {@link bindProfileBusChatStateReplaced} (profile bus).
     */
    bindProfileBusChatStateReplaced(bus: ProfileMessageBus | null): void {
        this.chatStateBusUnsubscribe?.();
        this.chatStateBusUnsubscribe = null;
        if (!bus) {
            return;
        }
        this.chatStateBusUnsubscribe = bus.subscribeTo("chat-state-replaced", (ev) => {
            this.queueChatReplaceDetail({
                publicKeyHex: ev.publicKeyHex,
                profileId: ev.profileId,
            });
        });
    }

    dispose(): void {
        if (!this.isInitialized) return;
        this.isInitialized = false;

        if (this.unsubscribeMessageBus) {
            this.unsubscribeMessageBus();
            this.unsubscribeMessageBus = null;
        }

        if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.onBeforeUnload);
            window.removeEventListener("privacy-settings-changed", this.onPrivacySettingsChanged);
        }
        this.chatStateBusUnsubscribe?.();
        this.chatStateBusUnsubscribe = null;

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
        this.pendingSupersededIds.clear();
        this.batchedEventCount = 0;
        this.currentBatchStartMs = null;
        this.pruneDeleteTombstones();
        this.recentlyDeletedMessageIds.clear();
        this.isFlushing = false;
    }

    private scheduleFlush(): void {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            void this.flushQueue();
        }, this.flushIntervalMs);
    }

    private getQueuedOperationCount(): number {
        return this.pendingUpserts.size + this.pendingDeletes.size;
    }

    private pruneDeleteTombstones(nowMs: number = Date.now()): void {
        if (this.recentlyDeletedMessageIds.size === 0) return;
        for (const [id, deletedAt] of this.recentlyDeletedMessageIds.entries()) {
            if (nowMs - deletedAt > this.deleteTombstoneTtlMs) {
                this.recentlyDeletedMessageIds.delete(id);
            }
        }
    }

    private markMessageDeleted(messageId: string, deletedAtMs: number = Date.now()): void {
        this.pruneDeleteTombstones(deletedAtMs);
        this.recentlyDeletedMessageIds.set(messageId, deletedAtMs);
    }

    private normalizeDeletedMessageIds(
        messageId: string | undefined,
        messageIdentityIds?: ReadonlyArray<string>,
    ): ReadonlyArray<string> {
        const ids = new Set<string>();
        const primaryId = messageId?.trim() ?? "";
        if (primaryId.length > 0) {
            ids.add(primaryId);
        }
        (messageIdentityIds ?? []).forEach((value) => {
            const normalized = typeof value === "string" ? value.trim() : "";
            if (normalized.length > 0) {
                ids.add(normalized);
            }
        });
        return Array.from(ids);
    }

    private isRecentlyDeleted(messageId: string, nowMs: number = Date.now()): boolean {
        const deletedAt = this.recentlyDeletedMessageIds.get(messageId);
        if (typeof deletedAt !== "number") return false;
        if (nowMs - deletedAt > this.deleteTombstoneTtlMs) {
            this.recentlyDeletedMessageIds.delete(messageId);
            return false;
        }
        return true;
    }

    private queueMessageUpsert(conversationId: string, message: Message): void {
        const nowMs = performance.now();
        // Use eventId as canonical key when available so v2 optimistic writes
        // (id=UUID, eventId=nostrId) land on the same DB row as legacy-migrated
        // messages (id=nostrId). Without this, two different keys produce two rows.
        const canonicalId = (typeof message.eventId === "string" && message.eventId.trim().length > 0)
            ? message.eventId.trim()
            : message.id;
        if (this.isRecentlyDeleted(canonicalId, Date.now()) || this.isRecentlyDeleted(message.id, Date.now())) {
            return;
        }
        if (this.currentBatchStartMs === null) {
            this.currentBatchStartMs = nowMs;
        }
        this.batchedEventCount += 1;
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageBusEvents(1);
        }

        const persistedRecord: Record<string, unknown> = {
            ...message,
            id: canonicalId,
            conversationId,
            timestampMs: message.timestamp.getTime(),
        };
        // Remove any prior UUID-keyed entry for the same message and queue
        // deletion of any already-flushed UUID row in IndexedDB.
        if (canonicalId !== message.id) {
            this.pendingDeletes.delete(message.id);
            this.pendingUpserts.delete(message.id);
            this.pendingSupersededIds.add(message.id);
        } else if (isTauri()) {
            // On Tauri, SQLite uses INSERT OR IGNORE — the first write is permanent.
            // Never write the optimistic UUID row; wait until eventId is confirmed.
            return;
        }
        this.pendingDeletes.delete(canonicalId);
        this.pendingUpserts.set(canonicalId, persistedRecord);

        const queued = this.getQueuedOperationCount();
        if (queued >= this.immediateFlushThreshold) {
            void this.flushQueue();
            return;
        }
        this.scheduleFlush();
    }

    private queueMessageDelete(messageId: string): void {
        const nowMs = performance.now();
        this.markMessageDeleted(messageId);
        if (this.currentBatchStartMs === null) {
            this.currentBatchStartMs = nowMs;
        }
        this.batchedEventCount += 1;
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageBusEvents(1);
        }

        this.pendingUpserts.delete(messageId);
        this.pendingDeletes.add(messageId);

        const queued = this.getQueuedOperationCount();
        if (queued >= this.immediateFlushThreshold) {
            void this.flushQueue();
            return;
        }
        this.scheduleFlush();
    }

    private async flushQueue(): Promise<void> {
        if (this.isFlushing) return;
        if (this.getQueuedOperationCount() === 0) return;

        this.isFlushing = true;
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        const upserts = Array.from(this.pendingUpserts.values());
        const deletes = Array.from(this.pendingDeletes.values());
        const superseded = Array.from(this.pendingSupersededIds);
        const mergedCount = this.batchedEventCount - (upserts.length + deletes.length);
        const batchStartMs = this.currentBatchStartMs ?? performance.now();
        const flushStartMs = performance.now();

        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
        this.pendingSupersededIds.clear();
        this.batchedEventCount = 0;
        this.currentBatchStartMs = null;

        try {
            if (upserts.length > 0) {
                if (!isTauri()) {
                    await messagingDB.bulkPut("messages", upserts);
                }
                if (isTauri()) {
                    const profileId = getResolvedProfileId();
                    const latestByConversation = new Map<string, Record<string, unknown>>();
                    for (const raw of upserts) {
                        // raw.id is now canonicalId (eventId when known, else UUID).
                        // The queueMessageUpsert guard already blocks UUID-only entries on Tauri,
                        // but apply the same check here as a safety net.
                        const eventId = typeof raw.id === "string" ? raw.id
                            : typeof raw.eventId === "string" ? raw.eventId : "";
                        if (!eventId) continue;
                        // Skip if id looks like a UUID (no eventId available yet) — belt-and-suspenders
                        const hasRealEventId = typeof raw.eventId === "string" && raw.eventId.trim().length > 0;
                        const idLooksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
                        if (idLooksLikeUuid && !hasRealEventId) continue;
                        const conversationId = typeof raw.conversationId === "string" ? raw.conversationId : "";
                        const rec: MessageRecord = {
                            event_id: eventId,
                            profile_id: profileId,
                            conversation_id: conversationId,
                            sender_pubkey: typeof raw.senderPubkey === "string" ? raw.senderPubkey : "",
                            recipient_pubkey: typeof raw.recipientPubkey === "string" ? raw.recipientPubkey : "",
                            plaintext: typeof raw.content === "string" ? raw.content : "",
                            kind: typeof raw.kind === "number" ? raw.kind : 4,
                            created_at: typeof raw.timestampMs === "number" ? Math.floor(raw.timestampMs / 1000) : 0,
                            received_at: typeof raw.timestampMs === "number" ? raw.timestampMs : Date.now(),
                            is_outgoing: raw.isOutgoing === true,
                            reply_to_event_id: null,
                            has_attachment: false,
                        };
                        dbInsertMessage(rec).catch(() => {});
                        if (conversationId) {
                            const existing = latestByConversation.get(conversationId);
                            const existingTs = typeof existing?.timestampMs === "number" ? existing.timestampMs : 0;
                            const rawTs = typeof raw.timestampMs === "number" ? raw.timestampMs : 0;
                            if (!existing || rawTs >= existingTs) {
                                latestByConversation.set(conversationId, raw);
                            }
                        }
                    }
                    for (const [conversationId, raw] of latestByConversation) {
                        const senderPubkey = typeof raw.senderPubkey === "string" ? raw.senderPubkey : "";
                        const recipientPubkey = typeof raw.recipientPubkey === "string" ? raw.recipientPubkey : "";
                        const peerPubkey = raw.isOutgoing === true ? recipientPubkey : senderPubkey;
                        const convRec: ConversationRecord = {
                            id: conversationId,
                            profile_id: profileId,
                            peer_pubkey: peerPubkey,
                            last_event_id: typeof raw.id === "string" ? raw.id
                                : typeof raw.eventId === "string" ? raw.eventId : null,
                            last_message_at: typeof raw.timestampMs === "number" ? raw.timestampMs : null,
                            last_plaintext_preview: typeof raw.content === "string" ? raw.content.slice(0, 120) : null,
                            unread_count: 0,
                        };
                        dbUpsertConversation(convRec).catch(() => {});
                    }
                }
            }
            if (deletes.length > 0) {
                if (isTauri()) {
                    const profileId = getResolvedProfileId();
                    if (profileId) {
                        const nowMs = Date.now();
                        await dbDeleteMessages(deletes, profileId).catch(() => undefined);
                        await Promise.all(deletes.map((deleteId) => dbInsertTombstone({
                            event_id: deleteId,
                            profile_id: profileId,
                            deleted_at: nowMs,
                            deleted_by: "",
                        }).catch(() => undefined)));
                    }
                } else {
                    await messagingDB.bulkDelete("messages", deletes);
                }
            }
            // Clean up any superseded UUID-keyed rows from before eventId was known
            if (superseded.length > 0 && !isTauri()) {
                await Promise.all(superseded.map(id => messagingDB.delete("messages", id).catch(() => {})));
            }
            if (performanceMonitor.isEnabled()) {
                const flushLatencyMs = performance.now() - flushStartMs;
                const mergedOrDroppedCount = mergedCount > 0 ? mergedCount : 0;
                performanceMonitor.recordBatchFlush(
                    upserts.length + deletes.length,
                    mergedOrDroppedCount,
                    flushLatencyMs,
                    mergedOrDroppedCount
                );
                performanceMonitor.recordUIUpdateLatency(performance.now() - batchStartMs);
            }
            if (mergedCount > 0) {
                console.debug("[MessagePersistenceService] Merged duplicate events:", mergedCount);
            }
        } catch (e) {
            console.error("[MessagePersistenceService] Failed to flush queued message operations:", e);
        } finally {
            this.isFlushing = false;
            if (this.getQueuedOperationCount() > 0) {
                this.scheduleFlush();
            }
        }
    }

    private async saveMessage(conversationId: string, message: Message, eventType: "new_message" | "message_updated") {
        if (performanceMonitor.isEnabled()) {
            performanceMonitor.recordMessageSent();
        }
        // Use eventId as canonical key when available (same logic as queueMessageUpsert)
        const canonicalId = (typeof message.eventId === "string" && message.eventId.trim().length > 0)
            ? message.eventId.trim()
            : message.id;
        if (this.isRecentlyDeleted(canonicalId, Date.now()) || this.isRecentlyDeleted(message.id, Date.now())) {
            return;
        }

        if (this.chatPerformanceV2Enabled) {
            this.queueMessageUpsert(conversationId, message);
            return;
        }

        if (!isTauri()) {
            try {
                await messagingDB.put("messages", {
                    ...message,
                    id: canonicalId,
                    conversationId,
                    timestampMs: message.timestamp.getTime(),
                });
                // Remove any UUID-keyed duplicate row that may have been written before eventId was known
                if (canonicalId !== message.id) {
                    await messagingDB.delete("messages", message.id).catch(() => {});
                }
                if (performanceMonitor.isEnabled()) {
                    performanceMonitor.recordMessageLatency(eventType === "new_message" ? 0 : 1);
                }
            } catch (e) {
                console.error("[MessagePersistenceService] Failed to save message:", e);
            }
        }
    }

    private async deleteMessage(messageId: string, messageIdentityIds?: ReadonlyArray<string>, conversationId?: string) {
        const deleteIds = this.normalizeDeletedMessageIds(messageId, messageIdentityIds);
        const activeProfile = getResolvedProfileId() || undefined;
        const nowMs = Date.now();
        deleteIds.forEach((deleteId) => {
            this.markMessageDeleted(deleteId);
        });
        if (conversationId?.trim()) {
            await messagingClientOperations.persistDmSuppressionOnly({
                conversationId,
                messageIdentityIds: deleteIds,
                deletedAtUnixMs: nowMs,
                profileId: activeProfile,
            });
        }
        if (this.chatPerformanceV2Enabled) {
            deleteIds.forEach((deleteId) => {
                this.queueMessageDelete(deleteId);
            });
            return;
        }

        if (!isTauri()) {
            try {
                await Promise.all(deleteIds.map((deleteId) => messagingDB.delete("messages", deleteId)));
            } catch (e) {
                console.error("[MessagePersistenceService] Failed to delete message:", e);
            }
        }
    }

    /**
     * Initial migration: Call this if we want to move messages from the 
     * legacy 'chatState' blob to the 'messages' store.
     */
    async migrateFromLegacy(publicKeyHex: string, options?: Readonly<{ profileId?: string }>) {
        if (isTauri()) {
            return;
        }
        try {
            const normalizedPublicKeyHex = normalizePublicKeyHex(publicKeyHex);
            if (!normalizedPublicKeyHex) {
                return;
            }
            const profileId = options?.profileId ?? getResolvedProfileId();
            const activeScopeKey = `${profileId}::${normalizedPublicKeyHex}`;

            // Guard: run migration at most once per profile scope. The v2 DM pipeline
            // owns the messages store going forward. Re-running clear()+reimport on
            // every CHAT_STATE_REPLACED_EVENT (every ~60s) writes legacy id=nostrId rows
            // that conflict with v2 id=UUID optimistic rows, producing persistent duplicates.
            const migrationDoneKey = `${MessagePersistenceService.MIGRATION_DONE_KEY_PREFIX}${activeScopeKey}`;
            if (typeof localStorage !== "undefined" && localStorage.getItem(migrationDoneKey) === "done") {
                return;
            }

            if (this.activeMessageStoreScopeKey !== activeScopeKey) {
                await messagingDB.clear("messages");
                this.activeMessageStoreScopeKey = activeScopeKey;
            }
            const cachedChatState = chatStateStoreService.load(normalizedPublicKeyHex as PublicKeyHex, {
                profileId,
            });
            const dbState = hasLegacyChatTimelineDomains(cachedChatState)
                ? cachedChatState
                : (await messagingDB.get<any>("chatState", normalizedPublicKeyHex) ?? cachedChatState);
            if (!dbState) {
                dispatchMessagesIndexRebuiltEvent({
                    publicKeyHex: normalizedPublicKeyHex,
                    profileId,
                    messageCount: 0,
                });
                return;
            }

            const allMessages: Array<Record<string, unknown>> = [];
            let incomingCount = 0;
            let outgoingCount = 0;

            const normalizedMessagesByConversationId = dbState.messagesByConversationId
                ? fromPersistedMessagesByConversationId(
                    dbState.messagesByConversationId,
                    {
                        myPublicKeyHex: normalizedPublicKeyHex as PublicKeyHex,
                    }
                )
                : {};
            Object.entries(normalizedMessagesByConversationId).forEach(([cid, msgs]) => {
                msgs.forEach((message) => {
                    if (message.isOutgoing) {
                        outgoingCount++;
                    } else {
                        incomingCount++;
                    }
                    allMessages.push({
                        ...message,
                        conversationId: message.conversationId ?? cid,
                        timestampMs: message.timestamp.getTime()
                    });
                });
            });

            if (allMessages.length > 0) {
                console.log("[MessagePersistenceService] Migration directionality:", {
                    total: allMessages.length,
                    outgoing: outgoingCount,
                    incoming: incomingCount,
                    outgoingRatio: outgoingCount / allMessages.length,
                });
            }

            if (dbState.groupMessages) {
                Object.entries(dbState.groupMessages).forEach(([cid, msgs]: [string, any]) => {
                    msgs.forEach((m: any) => {
                            allMessages.push({
                                id: m.id,
                                kind: 'user',
                                content: m.content,
                                timestampMs: (m.created_at * 1000),
                                isOutgoing: (m.pubkey === normalizedPublicKeyHex),
                                status: 'delivered',
                                senderPubkey: m.pubkey,
                                conversationId: cid
                            });
                        });
                });
            }

            if (allMessages.length > 0) {
                await messagingDB.bulkPut("messages", allMessages);
                console.info(`[MessagePersistenceService] Migrated ${allMessages.length} messages to 'messages' store.`);
            }
            // Mark migration as done so subsequent CHAT_STATE_REPLACED_EVENT calls are no-ops
            if (typeof localStorage !== "undefined") {
                try {
                    const migrationDoneKey = `${MessagePersistenceService.MIGRATION_DONE_KEY_PREFIX}${activeScopeKey}`;
                    localStorage.setItem(migrationDoneKey, "done");
                } catch {
                    // localStorage may be full; non-fatal — migration will re-run on next load
                }
            }

            dispatchMessagesIndexRebuiltEvent({
                publicKeyHex: normalizedPublicKeyHex,
                profileId,
                messageCount: allMessages.length,
            });

            const sourceDmDiagnostics = summarizeSourceDmConversationIds(
                dbState.messagesByConversationId as Readonly<Record<string, unknown>> | undefined,
                normalizedPublicKeyHex as PublicKeyHex,
            );
            const migratedDiagnostics = summarizeMigratedMessages(
                allMessages,
                normalizedPublicKeyHex as PublicKeyHex,
            );
            const persistedConversationIdSet = new Set(collectPersistedConversationIds(dbState as Record<string, unknown>));
            const migratedConversationIdSet = new Set(
                allMessages
                    .map((message) => typeof message.conversationId === "string" ? message.conversationId.trim() : "")
                    .filter((conversationId) => conversationId.length > 0)
            );
            const persistedConversationsWithoutMigratedHistory = Array.from(persistedConversationIdSet)
                .filter((conversationId) => !migratedConversationIdSet.has(conversationId)).length;
            const migratedConversationsNotInPersistedLists = Array.from(migratedConversationIdSet)
                .filter((conversationId) => !persistedConversationIdSet.has(conversationId)).length;
            const potentialConversationSplitDetected = (
                sourceDmDiagnostics.canonicalCollisionCount > 0
                && migratedDiagnostics.incomingOnlyConversationCount > 0
            );
            logAppEvent({
                name: "messaging.legacy_migration_diagnostics",
                level: potentialConversationSplitDetected ? "warn" : "info",
                scope: { feature: "messaging", action: "legacy_migration" },
                context: {
                    publicKeySuffix: normalizedPublicKeyHex.slice(-8),
                    profileId,
                    sourceConversationCount: sourceDmDiagnostics.sourceConversationCount,
                    canonicalConversationCount: sourceDmDiagnostics.canonicalConversationCount,
                    canonicalMismatchConversationCount: sourceDmDiagnostics.canonicalMismatchConversationCount,
                    canonicalCollisionCount: sourceDmDiagnostics.canonicalCollisionCount,
                    canonicalCollisionSample: sourceDmDiagnostics.canonicalCollisionSample,
                    migratedConversationCount: migratedDiagnostics.migratedConversationCount,
                    migratedMessageCount: migratedDiagnostics.migratedMessageCount,
                    migratedOutgoingCount: migratedDiagnostics.migratedOutgoingCount,
                    migratedIncomingCount: migratedDiagnostics.migratedIncomingCount,
                    incomingOnlyConversationCount: migratedDiagnostics.incomingOnlyConversationCount,
                    persistedConversationCount: persistedConversationIdSet.size,
                    persistedConversationsWithoutMigratedHistory,
                    migratedConversationsNotInPersistedLists,
                    potentialConversationSplitDetected,
                },
            });
        } catch (e) {
            console.error("[MessagePersistenceService] Migration failed:", e);
        }
    }
}

export const messagePersistenceService = new MessagePersistenceService();
