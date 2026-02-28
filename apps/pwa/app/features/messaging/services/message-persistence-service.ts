import { messageBus, type MessageBusEvent } from "./message-bus";
import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message } from "../types";

/**
 * MessagePersistenceService
 * 
 * listens to the MessageBus and ensures every message event is reflected 
 * in the high-performance IndexedDB 'messages' store.
 */
class MessagePersistenceService {
    private isInitialized = false;

    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        messageBus.subscribe((event: MessageBusEvent) => {
            switch (event.type) {
                case 'new_message':
                case 'message_updated':
                    this.saveMessage(event.conversationId, event.message);
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
    }

    private async saveMessage(conversationId: string, message: Message) {
        try {
            await messagingDB.put("messages", {
                ...message,
                conversationId,
                timestampMs: message.timestamp.getTime(),
                // Store timestamp as number for indexing
            });
        } catch (e) {
            console.error("[MessagePersistenceService] Failed to save message:", e);
        }
    }

    private async deleteMessage(messageId: string) {
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
