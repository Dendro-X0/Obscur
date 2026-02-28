import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
    PersistedChatState,
    PersistedDmConversation,
    PersistedGroupConversation,
    PersistedGroupMessage,
    PersistedContactOverride,
    PersistedMessage,
    PersistedConnectionRequest
} from "../types";
import { loadPersistedChatState, savePersistedChatState } from "../utils/persistence";
import { messagingDB } from "@dweb/storage/indexed-db";

type SaveOptions = Readonly<{
    debounceMs?: number;
}>;

type PendingSave = {
    timeoutId: number | null;
    latest: PersistedChatState | null;
};

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * ChatStateStore Service
 * 
 * Provides atomic, debounced access to the persisted chat state in localStorage.
 * Prevents race conditions between different providers (Messaging, Groups, Invites)
 * by managing a single in-memory "pending" state per public key.
 */
class ChatStateStore {
    private pendingByPublicKey = new Map<PublicKeyHex, PendingSave>();
    private memoryCacheByPublicKey = new Map<PublicKeyHex, PersistedChatState>();

    /**
     * Loads the current state from localStorage or memory cache.
     * Use hydrateMessages() for async message loading.
     */
    load(publicKeyHex: PublicKeyHex): PersistedChatState | null {
        const pending = this.pendingByPublicKey.get(publicKeyHex);
        if (pending?.latest) {
            return pending.latest;
        }

        const cached = this.memoryCacheByPublicKey.get(publicKeyHex);
        if (cached) {
            return cached;
        }

        const reloaded = loadPersistedChatState(publicKeyHex);
        if (reloaded) {
            this.memoryCacheByPublicKey.set(publicKeyHex, reloaded);
        }
        return reloaded;
    }

    /**
     * Async hydration of messages from IndexedDB.
     */
    async hydrateMessages(publicKeyHex: PublicKeyHex): Promise<void> {
        if (typeof window === "undefined") return;

        try {
            const dbState = await messagingDB.get<PersistedChatState>("chatState", publicKeyHex);
            if (dbState) {
                this.update(publicKeyHex, prev => ({
                    ...prev,
                    messagesByConversationId: {
                        ...prev.messagesByConversationId,
                        ...dbState.messagesByConversationId
                    },
                    groupMessages: {
                        ...prev.groupMessages,
                        ...dbState.groupMessages
                    }
                }));
            }
        } catch (e) {
            console.error("[ChatStateStore] Failed to hydrate messages from IndexedDB:", e);
        }
    }

    /**
     * Updates a slice of the chat state atomically.
     */
    update(publicKeyHex: PublicKeyHex, updater: (prev: PersistedChatState) => PersistedChatState): void {
        const current = this.load(publicKeyHex) || this.createInitialState();
        const next = updater(current);
        this.memoryCacheByPublicKey.set(publicKeyHex, next);
        this.save(publicKeyHex, next);
    }

    /**
     * Atomic updates for specific state slices
     */
    updateContacts(publicKeyHex: PublicKeyHex, contacts: ReadonlyArray<PersistedDmConversation>): void {
        this.update(publicKeyHex, prev => ({ ...prev, createdContacts: contacts }));
    }

    updateGroups(publicKeyHex: PublicKeyHex, groups: ReadonlyArray<PersistedGroupConversation>): void {
        this.update(publicKeyHex, prev => ({ ...prev, createdGroups: groups }));
    }

    updateMessages(publicKeyHex: PublicKeyHex, messagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>>): void {
        this.update(publicKeyHex, prev => ({
            ...prev,
            messagesByConversationId: { ...prev.messagesByConversationId, ...messagesByConversationId }
        }));
    }

    updateGroupMessages(publicKeyHex: PublicKeyHex, groupMessages: Record<string, ReadonlyArray<PersistedGroupMessage>>): void {
        this.update(publicKeyHex, prev => ({
            ...prev,
            groupMessages: { ...prev.groupMessages, ...groupMessages }
        }));
    }

    updateUnreadCounts(publicKeyHex: PublicKeyHex, unreadByConversationId: Record<string, number>): void {
        this.update(publicKeyHex, prev => ({ ...prev, unreadByConversationId }));
    }

    updateContactOverrides(publicKeyHex: PublicKeyHex, overrides: Record<string, PersistedContactOverride>): void {
        this.update(publicKeyHex, prev => ({ ...prev, contactOverridesByContactId: overrides }));
    }

    updateConnectionRequests(publicKeyHex: PublicKeyHex, requests: ReadonlyArray<PersistedConnectionRequest>): void {
        this.update(publicKeyHex, prev => ({ ...prev, connectionRequests: requests }));
    }

    updatePinnedChats(publicKeyHex: PublicKeyHex, pinnedChatIds: ReadonlyArray<string>): void {
        this.update(publicKeyHex, prev => ({ ...prev, pinnedChatIds }));
    }

    updateHiddenChats(publicKeyHex: PublicKeyHex, hiddenChatIds: ReadonlyArray<string>): void {
        this.update(publicKeyHex, prev => ({ ...prev, hiddenChatIds }));
    }

    /**
     * Schedules a save operation for the state.
     */
    private save(publicKeyHex: PublicKeyHex, state: PersistedChatState, options?: SaveOptions): void {
        if (typeof window === "undefined") {
            savePersistedChatState(state, publicKeyHex);
            return;
        }

        const debounceMs: number = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
        const pending: PendingSave = this.pendingByPublicKey.get(publicKeyHex) ?? { timeoutId: null, latest: null };
        pending.latest = state;

        if (pending.timeoutId !== null) {
            window.clearTimeout(pending.timeoutId);
        }

        pending.timeoutId = window.setTimeout(async () => {
            const latest = pending.latest;
            pending.timeoutId = null;
            pending.latest = null;
            if (!latest) return;

            // Partition and Save:
            // 1. Full state to IndexedDB for high-capacity storage
            try {
                await messagingDB.put("chatState", { ...latest, publicKeyHex });
            } catch (e) {
                console.warn("[ChatStateStore] IndexedDB put failed, falling back to LocalStorage only", e);
            }

            // 2. Metadata-only state to localStorage to keep it under the limit
            const metadataOnly: PersistedChatState = {
                ...latest,
                messagesByConversationId: {},
                groupMessages: {}
            };
            savePersistedChatState(metadataOnly, publicKeyHex);
        }, debounceMs);

        this.pendingByPublicKey.set(publicKeyHex, pending);
    }

    /**
     * Immediately flushes any pending writes to storage.
     */
    async flush(publicKeyHex: PublicKeyHex): Promise<void> {
        if (typeof window === "undefined") return;
        const pending = this.pendingByPublicKey.get(publicKeyHex);
        if (!pending?.latest) return;

        if (pending.timeoutId !== null) {
            window.clearTimeout(pending.timeoutId);
        }

        const latest = pending.latest;
        pending.timeoutId = null;
        pending.latest = null;

        try {
            await messagingDB.put("chatState", { ...latest, publicKeyHex });
        } catch (e) {
            console.warn("[ChatStateStore] Flush to IndexedDB failed", e);
        }

        const metadataOnly: PersistedChatState = {
            ...latest,
            messagesByConversationId: {},
            groupMessages: {}
        };
        savePersistedChatState(metadataOnly, publicKeyHex);
    }

    private createInitialState(): PersistedChatState {
        return {
            version: 2,
            createdContacts: [],
            createdGroups: [],
            unreadByConversationId: {},
            contactOverridesByContactId: {},
            messagesByConversationId: {},
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: []
        };
    }
    /**
     * Searches for messages containing the query string across all conversations.
     * Uses a cursor to avoid loading everything into memory at once.
     */
    async searchMessages(query: string, limit: number = 50): Promise<ReadonlyArray<{ conversationId: string; message: PersistedMessage }>> {
        if (typeof window === "undefined" || !query) return [];

        const db = await messagingDB["ensureDB"](); // Accessing private for utility, or we can add a helper
        const lowerQuery = query.toLowerCase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction("messages", "readonly");
            const store = transaction.objectStore("messages");
            const request = store.index("timestampMs").openCursor(null, "prev"); // Search newest first

            const results: Array<{ conversationId: string; message: PersistedMessage }> = [];
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const msg = cursor.value;
                    if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
                        results.push({
                            conversationId: msg.conversationId,
                            message: msg
                        });
                    }

                    if (results.length >= limit) {
                        resolve(results);
                    } else {
                        cursor.continue();
                    }
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Deletes all messages for a specific conversation from IndexedDB.
     */
    async deleteConversationMessages(conversationId: string): Promise<void> {
        if (typeof window === "undefined") return;

        const db = await messagingDB["ensureDB"]();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction("messages", "readwrite");
            const store = transaction.objectStore("messages");
            const index = store.index("conversation_timestamp");
            const range = IDBKeyRange.bound([conversationId, 0], [conversationId, Date.now()]);
            const request = index.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}

export const chatStateStoreService = new ChatStateStore();
