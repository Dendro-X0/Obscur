import { messageBus, type MessageBusEvent } from "./message-bus";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message } from "../types";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "../../profile/utils/normalize-public-key-hex";
import { CHAT_STATE_REPLACED_EVENT } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import { toDmConversationId } from "../utils/dm-conversation-id";
import { logAppEvent } from "@/app/shared/log-app-event";

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
    private recentlyDeletedMessageIds = new Map<string, number>();
    private flushTimer: ReturnType<typeof setTimeout> | null = null;
    private isFlushing = false;
    private batchedEventCount = 0;
    private currentBatchStartMs: number | null = null;
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
    private readonly onChatStateReplaced = (event: Event): void => {
        const customEvent = event as CustomEvent<Readonly<{ publicKeyHex?: string }>>;
        const restoredPublicKeyHex = normalizePublicKeyHex(customEvent.detail?.publicKeyHex);
        if (!restoredPublicKeyHex) {
            return;
        }
        void this.migrateFromLegacy(restoredPublicKeyHex);
    };

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.chatPerformanceV2Enabled = PrivacySettingsService.getSettings().chatPerformanceV2;

        this.unsubscribeMessageBus = messageBus.subscribe((event: MessageBusEvent) => {
            switch (event.type) {
                case 'new_message':
                case 'message_updated':
                    this.saveMessage(event.conversationId, event.message, event.type);
                    break;
                case 'message_deleted':
                    if (event.messageId === 'all') {
                        // Handled by chatStateStoreService.deleteConversationMessages usually,
                        // but we can also handle it here if we want absolute decoupling.
                    } else {
                        this.deleteMessage(event.messageId);
                    }
                    break;
            }
        });

        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", this.onVisibilityChange);
        }
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", this.onBeforeUnload);
            window.addEventListener("privacy-settings-changed", this.onPrivacySettingsChanged);
            window.addEventListener(CHAT_STATE_REPLACED_EVENT, this.onChatStateReplaced as EventListener);
        }
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
            window.removeEventListener(CHAT_STATE_REPLACED_EVENT, this.onChatStateReplaced as EventListener);
        }

        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
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
        if (this.isRecentlyDeleted(message.id, Date.now())) {
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
            conversationId,
            timestampMs: message.timestamp.getTime(),
        };
        this.pendingDeletes.delete(message.id);
        this.pendingUpserts.set(message.id, persistedRecord);

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
        const mergedCount = this.batchedEventCount - (upserts.length + deletes.length);
        const batchStartMs = this.currentBatchStartMs ?? performance.now();
        const flushStartMs = performance.now();

        this.pendingUpserts.clear();
        this.pendingDeletes.clear();
        this.batchedEventCount = 0;
        this.currentBatchStartMs = null;

        try {
            if (upserts.length > 0) {
                await messagingDB.bulkPut("messages", upserts);
            }
            if (deletes.length > 0) {
                await messagingDB.bulkDelete("messages", deletes);
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
        if (this.isRecentlyDeleted(message.id, Date.now())) {
            return;
        }

        if (this.chatPerformanceV2Enabled) {
            this.queueMessageUpsert(conversationId, message);
            return;
        }

        try {
            await messagingDB.put("messages", {
                ...message,
                conversationId,
                timestampMs: message.timestamp.getTime(),
                // Store timestamp as number for indexing
            });
            if (performanceMonitor.isEnabled()) {
                performanceMonitor.recordMessageLatency(eventType === "new_message" ? 0 : 1);
            }
        } catch (e) {
            console.error("[MessagePersistenceService] Failed to save message:", e);
        }
    }

    private async deleteMessage(messageId: string) {
        this.markMessageDeleted(messageId);
        if (this.chatPerformanceV2Enabled) {
            this.queueMessageDelete(messageId);
            return;
        }

        try {
            await messagingDB.delete("messages", messageId);
        } catch (e) {
            console.error("[MessagePersistenceService] Failed to delete message:", e);
        }
    }

    /**
     * Initial migration: Call this if we want to move messages from the 
     * legacy 'chatState' blob to the 'messages' store.
     */
    async migrateFromLegacy(publicKeyHex: string) {
        try {
            const normalizedPublicKeyHex = normalizePublicKeyHex(publicKeyHex);
            if (!normalizedPublicKeyHex) {
                return;
            }
            const dbState = await messagingDB.get<any>("chatState", normalizedPublicKeyHex);
            if (!dbState) return;

            const allMessages: Array<Record<string, unknown>> = [];

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
                    allMessages.push({
                        ...message,
                        conversationId: message.conversationId ?? cid,
                        timestampMs: message.timestamp.getTime()
                    });
                });
            });

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
