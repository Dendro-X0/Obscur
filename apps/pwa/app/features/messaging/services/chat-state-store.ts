import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
    PersistedChatState,
    PersistedDmConversation,
    PersistedGroupConversation,
    PersistedGroupMessage,
    PersistedConnectionOverride,
    PersistedMessage,
    PersistedConnectionRequest
} from "../types";
import { loadPersistedChatState, normalizePersistedGroupState, savePersistedChatState } from "../utils/persistence";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { buildMessageSearchIndexText } from "@/app/features/messaging/services/message-search-index";

export const CHAT_STATE_REPLACED_EVENT = "obscur:chat-state-replaced";
export type ChatStateReplacedEventDetail = Readonly<{
    publicKeyHex: string;
    profileId: string;
}>;

type SaveOptions = Readonly<{
    debounceMs?: number;
    profileId?: string;
}>;

type ReplaceOptions = Readonly<{
    emitMutationSignal?: boolean;
    profileId?: string;
}>;

type PendingSave = {
    timeoutId: number | null;
    latest: PersistedChatState | null;
};

const DEFAULT_DEBOUNCE_MS = 250;
const toPublicKeySuffix = (publicKeyHex: PublicKeyHex): string => publicKeyHex.slice(-8);
const toScopedCacheKey = (publicKeyHex: PublicKeyHex, profileId: string): string => `${profileId}::${publicKeyHex}`;
/**
 * ChatStateStore Service
 * 
 * Provides atomic, debounced access to the persisted chat state in localStorage.
 * Prevents race conditions between different providers (Messaging, Groups, Invites)
 * by managing a single in-memory "pending" state per public key.
 */
class ChatStateStore {
    private pendingByScopeKey = new Map<string, PendingSave>();
    private memoryCacheByScopeKey = new Map<string, PersistedChatState>();

    /**
     * Loads the current state from localStorage or memory cache.
     * Use hydrateMessages() for async message loading.
     */
    load(publicKeyHex: PublicKeyHex, options?: Readonly<{ profileId?: string }>): PersistedChatState | null {
        const profileId = options?.profileId ?? getResolvedProfileId();
        const scopeKey = toScopedCacheKey(publicKeyHex, profileId);
        const pending = this.pendingByScopeKey.get(scopeKey);
        if (pending?.latest) {
            return pending.latest;
        }

        const cached = this.memoryCacheByScopeKey.get(scopeKey);
        if (cached) {
            return cached;
        }

        const reloaded = loadPersistedChatState(publicKeyHex, { profileId });
        if (reloaded) {
            this.memoryCacheByScopeKey.set(scopeKey, reloaded);
        }
        return reloaded;
    }

    /** No-op — IndexedDB hydration permanently excluded. */
    async hydrateMessages(_publicKeyHex: PublicKeyHex): Promise<void> {
        return;
    }

    /**
     * Updates a slice of the chat state atomically.
     * Pass `silent: true` to skip the mutation signal — use only for internal
     * hydration reads that are not user-driven mutations (e.g. hydrateMessages).
     */
    update(
        publicKeyHex: PublicKeyHex,
        updater: (prev: PersistedChatState) => PersistedChatState,
        options?: Readonly<{ silent?: boolean; debounceMs?: number; profileId?: string }>
    ): void {
        const profileId = options?.profileId ?? getResolvedProfileId();
        const scopeKey = toScopedCacheKey(publicKeyHex, profileId);
        const current = this.load(publicKeyHex, { profileId }) || this.createInitialState();
        const next = updater(current);
        if (next === current) {
            return;
        }
        this.memoryCacheByScopeKey.set(scopeKey, next);
        this.save(publicKeyHex, next, { profileId, debounceMs: options?.debounceMs });
        if (!options?.silent) {
            emitAccountSyncMutation("chat_state_changed");
        }
    }

    /**
     * Atomic updates for specific state slices
     */
    updateConnections(publicKeyHex: PublicKeyHex, connections: ReadonlyArray<PersistedDmConversation>): void {
        this.update(publicKeyHex, prev => ({ ...prev, createdConnections: connections }));
    }

    updateGroups(publicKeyHex: PublicKeyHex, groups: ReadonlyArray<PersistedGroupConversation>): void {
        logAppEvent({
            name: "messaging.chat_state_groups_update",
            level: "info",
            scope: { feature: "messaging", action: "chat_state_store" },
            context: {
                publicKeySuffix: toPublicKeySuffix(publicKeyHex),
                profileId: getResolvedProfileId(),
                groupCount: groups.length,
            },
        });
        this.update(publicKeyHex, prev => ({ ...prev, createdGroups: groups }), { debounceMs: 0 });
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

    updateConnectionOverrides(publicKeyHex: PublicKeyHex, overrides: Record<string, PersistedConnectionOverride>): void {
        this.update(publicKeyHex, prev => ({ ...prev, connectionOverridesByConnectionId: overrides }));
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

    removeMessageIdentities(
        publicKeyHex: PublicKeyHex,
        conversationId: string,
        messageIdentityIds: ReadonlyArray<string>,
    ): void {
        const deleteIds = new Set(
            messageIdentityIds
                .map((value) => value.trim())
                .filter((value) => value.length > 0)
        );
        if (deleteIds.size === 0) {
            return;
        }
        this.update(publicKeyHex, (prev) => {
            const existingMessages = prev.messagesByConversationId[conversationId] ?? [];
            const filteredMessages = existingMessages.filter((message) => {
                const messageId = String(message.id ?? "").trim();
                const eventId = String(message.eventId ?? "").trim();
                return !deleteIds.has(messageId) && !deleteIds.has(eventId);
            });
            const existingGroupMessages = prev.groupMessages?.[conversationId] ?? [];
            const filteredGroupMessages = existingGroupMessages.filter((message) => {
                const messageId = String(message.id ?? "").trim();
                const eventId = String((message as { eventId?: string }).eventId ?? "").trim();
                return !deleteIds.has(messageId) && !deleteIds.has(eventId);
            });
            const nextMessagesByConversationId = {
                ...prev.messagesByConversationId,
                [conversationId]: filteredMessages,
            };
            const nextGroupMessages = {
                ...(prev.groupMessages ?? {}),
                [conversationId]: filteredGroupMessages,
            };
            const latestMessage = filteredMessages[filteredMessages.length - 1];
            const nextCreatedConnections = prev.createdConnections.map((connection) => {
                if (connection.id !== conversationId) {
                    return connection;
                }
                if (!latestMessage) {
                    return {
                        ...connection,
                        lastMessage: "",
                        lastMessageTimeMs: 0,
                    };
                }
                return {
                    ...connection,
                    lastMessage: latestMessage.content ?? "",
                    lastMessageTimeMs: latestMessage.timestampMs,
                };
            });
            return {
                ...prev,
                createdConnections: nextCreatedConnections,
                messagesByConversationId: nextMessagesByConversationId,
                groupMessages: nextGroupMessages,
            };
        });
    }

    removeMessageIdentitiesFromAllActiveScopes(
        conversationId: string,
        messageIdentityIds: ReadonlyArray<string>,
        options?: Readonly<{ profileId?: string; publicKeyHex?: PublicKeyHex }>,
    ): void {
        const deleteIds = new Set(
            messageIdentityIds
                .map((v) => v.trim())
                .filter((v) => v.length > 0),
        );
        if (deleteIds.size === 0) {
            return;
        }
        const activeProfileId = options?.profileId ?? getResolvedProfileId();
        const scopeKeys = new Set<string>();
        if (options?.publicKeyHex) {
            scopeKeys.add(toScopedCacheKey(options.publicKeyHex, activeProfileId));
        } else {
            for (const scopeKey of this.memoryCacheByScopeKey.keys()) {
                if (scopeKey.startsWith(`${activeProfileId}::`)) {
                    scopeKeys.add(scopeKey);
                }
            }
            for (const scopeKey of this.pendingByScopeKey.keys()) {
                if (scopeKey.startsWith(`${activeProfileId}::`)) {
                    scopeKeys.add(scopeKey);
                }
            }
        }
        scopeKeys.forEach((scopeKey) => {
            const colonIdx = scopeKey.indexOf("::");
            if (colonIdx < 0) {
                return;
            }
            const profileId = scopeKey.slice(0, colonIdx);
            const publicKeyHex = scopeKey.slice(colonIdx + 2) as PublicKeyHex;
            this.removeMessageIdentities(publicKeyHex, conversationId, messageIdentityIds);
            void this.flush(publicKeyHex, { profileId });
        });
    }

    replace(publicKeyHex: PublicKeyHex, nextState: PersistedChatState, options?: ReplaceOptions): void {
        const profileId = options?.profileId ?? getResolvedProfileId();
        const scopeKey = toScopedCacheKey(publicKeyHex, profileId);
        const normalizedState = normalizePersistedGroupState(nextState);
        this.memoryCacheByScopeKey.set(scopeKey, normalizedState);
        this.save(publicKeyHex, normalizedState, { debounceMs: 0, profileId });
        logAppEvent({
            name: "messaging.chat_state_replaced",
            level: "info",
            scope: { feature: "messaging", action: "chat_state_store" },
            context: {
                publicKeySuffix: toPublicKeySuffix(publicKeyHex),
                profileId,
                createdConnectionCount: normalizedState.createdConnections.length,
                createdGroupCount: normalizedState.createdGroups.length,
                dmConversationCount: Object.keys(normalizedState.messagesByConversationId ?? {}).length,
                groupConversationCount: Object.keys(normalizedState.groupMessages ?? {}).length,
            },
        });
        const runtime = getProfileRuntimeScope();
        if (runtime?.bus) {
            runtime.bus.publish({
                type: "chat-state-replaced",
                profileId,
                publicKeyHex,
            });
        }
        if (options?.emitMutationSignal !== false) {
            emitAccountSyncMutation("chat_state_changed");
        }
    }

    /**
     * Schedules a save operation for the state.
     */
    private save(publicKeyHex: PublicKeyHex, state: PersistedChatState, options?: SaveOptions): void {
        const profileId = options?.profileId ?? getResolvedProfileId();
        const scopeKey = toScopedCacheKey(publicKeyHex, profileId);
        if (typeof window === "undefined") {
            savePersistedChatState(state, publicKeyHex, { profileId });
            return;
        }

        const debounceMs: number = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
        const pending: PendingSave = this.pendingByScopeKey.get(scopeKey) ?? { timeoutId: null, latest: null };
        pending.latest = state;

        if (pending.timeoutId !== null) {
            window.clearTimeout(pending.timeoutId);
        }

        pending.timeoutId = window.setTimeout(async () => {
            const latest = pending.latest;
            pending.timeoutId = null;
            pending.latest = null;
            if (!latest) return;

            savePersistedChatState(latest, publicKeyHex, { profileId });
        }, debounceMs);

        this.pendingByScopeKey.set(scopeKey, pending);
    }

    /**
     * Immediately flushes any pending writes to storage.
     */
    async flush(publicKeyHex: PublicKeyHex, options?: Readonly<{ profileId?: string }>): Promise<void> {
        const profileId = options?.profileId ?? getResolvedProfileId();
        const scopeKey = toScopedCacheKey(publicKeyHex, profileId);
        if (typeof window === "undefined") return;
        const pending = this.pendingByScopeKey.get(scopeKey);
        if (!pending?.latest) return;

        if (pending.timeoutId !== null) {
            window.clearTimeout(pending.timeoutId);
        }

        const latest = pending.latest;
        pending.timeoutId = null;
        pending.latest = null;

        savePersistedChatState(latest, publicKeyHex, { profileId });
    }

    /** Flush every debounced scope — call on page hide / refresh so groups and chats survive reload. */
    flushAllPending(): void {
        if (typeof window === "undefined") {
            return;
        }
        for (const scopeKey of [...this.pendingByScopeKey.keys()]) {
            const colonIdx = scopeKey.indexOf("::");
            if (colonIdx < 0) {
                continue;
            }
            const profileId = scopeKey.slice(0, colonIdx);
            const publicKeyHex = scopeKey.slice(colonIdx + 2) as PublicKeyHex;
            void this.flush(publicKeyHex, { profileId });
        }
    }

    private createInitialState(): PersistedChatState {
        return {
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {},
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: []
        };
    }
    /** Drop in-memory caches for every scope except the active profile+pubkey pair. */
    purgeMemoryExcept(profileId: string, publicKeyHex: PublicKeyHex): void {
        const activeScopeKey = toScopedCacheKey(publicKeyHex, profileId);
        for (const scopeKey of [...this.memoryCacheByScopeKey.keys()]) {
            if (scopeKey !== activeScopeKey) {
                this.memoryCacheByScopeKey.delete(scopeKey);
            }
        }
        for (const scopeKey of [...this.pendingByScopeKey.keys()]) {
            if (scopeKey === activeScopeKey) {
                continue;
            }
            const pending = this.pendingByScopeKey.get(scopeKey);
            if (pending?.timeoutId !== null && pending?.timeoutId !== undefined && typeof window !== "undefined") {
                window.clearTimeout(pending.timeoutId);
            }
            this.pendingByScopeKey.delete(scopeKey);
        }
    }

    purgeAllMemory(): void {
        for (const scopeKey of [...this.pendingByScopeKey.keys()]) {
            const pending = this.pendingByScopeKey.get(scopeKey);
            if (pending?.timeoutId !== null && pending?.timeoutId !== undefined && typeof window !== "undefined") {
                window.clearTimeout(pending.timeoutId);
            }
        }
        this.pendingByScopeKey.clear();
        this.memoryCacheByScopeKey.clear();
    }

    /**
     * Uses a cursor to avoid loading everything into memory at once.
     */
    async searchMessages(query: string, limit: number = 50): Promise<ReadonlyArray<{ conversationId: string; message: PersistedMessage }>> {
        if (typeof window === "undefined" || !query) return [];
        const lowerQuery = query.toLowerCase();
        const results: Array<{ conversationId: string; message: PersistedMessage }> = [];
        for (const state of this.memoryCacheByScopeKey.values()) {
            const byConv = state.messagesByConversationId ?? {};
            for (const [conversationId, messages] of Object.entries(byConv)) {
                for (const message of messages) {
                    if (buildMessageSearchIndexText(message).includes(lowerQuery)) {
                        results.push({ conversationId, message });
                        if (results.length >= limit) {
                            return results;
                        }
                    }
                }
            }
        }
        return results;
    }

    /**
     * Deletes all messages for a specific conversation from IndexedDB.
     */
    async deleteConversationMessages(_conversationId: string): Promise<void> {
        return;
    }
}

export const chatStateStoreService = new ChatStateStore();
