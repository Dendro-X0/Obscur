import { messageBus, type MessageBusEvent } from "./message-bus";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message } from "../types";
import { PrivacySettingsService } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";

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
            const dbState = await messagingDB.get<any>("chatState", publicKeyHex);
            if (!dbState) return;

            const allMessages: any[] = [];

            if (dbState.messagesByConversationId) {
                Object.entries(dbState.messagesByConversationId).forEach(([cid, msgs]: [string, any]) => {
                    msgs.forEach((m: any) => {
                        allMessages.push({
                            ...m,
                            conversationId: cid,
                            timestampMs: new Date(m.timestampMs || m.created_at * 1000).getTime()
                        });
                    });
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
                            isOutgoing: (m.pubkey === publicKeyHex),
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
        } catch (e) {
            console.error("[MessagePersistenceService] Migration failed:", e);
        }
    }
}

export const messagePersistenceService = new MessagePersistenceService();
