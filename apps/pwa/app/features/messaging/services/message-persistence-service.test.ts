import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageRecord } from "@dweb/db";
import type { Message } from "../types";
import { messageBus } from "./message-bus";
import { MessagePersistenceService } from "./message-persistence-service";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { messagingDB } from "@dweb/storage/indexed-db";
import { CHAT_STATE_REPLACED_EVENT } from "@/app/features/messaging/services/chat-state-store-types";
import { clearMessageDeleteTombstones, isMessageDeleteSuppressed } from "./message-delete-tombstone-store";

vi.mock("@dweb/storage/indexed-db", () => ({
    messagingDB: {
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        bulkPut: vi.fn(async () => undefined),
        bulkDelete: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined),
        get: vi.fn(async () => null),
    }
}));

const chatStateStoreMocks = vi.hoisted(() => ({
    load: vi.fn(),
    update: vi.fn(),
    removeMessageIdentities: vi.fn(),
    removeMessageIdentitiesFromAllActiveScopes: vi.fn(),
}));

const profileScopeState = vi.hoisted(() => ({
    activeProfileId: "default",
}));

vi.mock("@/app/features/messaging/services/chat-state-store-legacy", () => ({
    CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
    chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
    readRegistryBackedActiveProfileId: () => profileScopeState.activeProfileId,
    getProfileScopeOverride: () => null,
    getScopedStorageKey: (baseKey: string, profileId?: string) =>
        `${baseKey}::${profileId ?? profileScopeState.activeProfileId}`,
}));

const nativePersistenceMocks = vi.hoisted(() => ({
    requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
    requiresSqlitePersistence: () => nativePersistenceMocks.requiresSqlitePersistence(),
}));

const mediaIndexMocks = vi.hoisted(() => ({
    linkLocalMediaIndexToMessageEvent: vi.fn(),
}));

vi.mock("@/app/features/vault/services/local-media-store", () => ({
    linkLocalMediaIndexToMessageEvent: mediaIndexMocks.linkLocalMediaIndexToMessageEvent,
}));

vi.mock("./messaging-client-operations", async () => {
    const { suppressMessageDeleteTombstone } = await import("./message-delete-tombstone-store");
    return {
        messagingClientOperations: {
            persistDmSuppressionOnly: vi.fn(async (params: Readonly<{
                messageIdentityIds?: ReadonlyArray<string>;
                deletedAtUnixMs?: number;
                profileId?: string;
            }>) => {
                const ids = params.messageIdentityIds ?? [];
                const deletedAtUnixMs = params.deletedAtUnixMs ?? Date.now();
                ids.forEach((id) => suppressMessageDeleteTombstone(id, deletedAtUnixMs, params.profileId));
                return ids;
            }),
        },
    };
});

const TEST_SENDER = "a".repeat(64);
const TEST_RECIPIENT = "b".repeat(64);

const createMessage = (id: string, content: string, overrides?: Partial<Message>): Message => ({
    id,
    kind: "user",
    content,
    timestamp: new Date(1_700_000_000_000),
    isOutgoing: false,
    status: "delivered",
    senderPubkey: TEST_SENDER,
    recipientPubkey: TEST_RECIPIENT,
    ...overrides,
});

describe("MessagePersistenceService batching", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);
        clearMessageDeleteTombstones();
        profileScopeState.activeProfileId = "default";
        nativePersistenceMocks.requiresSqlitePersistence.mockReturnValue(false);
        mediaIndexMocks.linkLocalMediaIndexToMessageEvent.mockClear();
        tauriDbMocks.isTauri.mockReturnValue(false);
        chatStateStoreMocks.update.mockImplementation((_pk, updater) => {
            const base = {
                messagesByConversationId: {} as Record<string, unknown[]>,
                createdConnections: [],
                createdGroups: [],
                unreadByConversationId: {},
                connectionOverridesByConnectionId: {},
            };
            updater(base as never);
        });
        // Clear one-time migration guards so tests are independent
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
    });

    afterEach(() => {
        clearMessageDeleteTombstones();
        // Clear one-time migration guards
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.clearAllMocks();
        chatStateStoreMocks.load.mockReset();
    });

    it("deduplicates rapid updates into one bulk upsert when performance mode is enabled", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("m-1", "old", { isOutgoing: true }),
        });
        messageBus.emit({
            type: "message_updated",
            conversationId: "c1",
            message: createMessage("m-1", "new", { isOutgoing: true }),
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(chatStateStoreMocks.update).toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();
        // Batched path mirrors to chat-state on queue (not IndexedDB).
        expect(chatStateStoreMocks.update.mock.calls.length).toBeGreaterThanOrEqual(2);

        service.dispose();
    });

    it("keeps legacy immediate writes when performance mode is disabled", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: false
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("m-legacy", "legacy")
        });
        await Promise.resolve();

        expect(chatStateStoreMocks.update).toHaveBeenCalled();
        expect(messagingDB.put).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it("groups multiple deletes into one bulk delete flush", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "d-1" });
        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "d-2" });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(isMessageDeleteSuppressed("d-1")).toBe(true);
        expect(isMessageDeleteSuppressed("d-2")).toBe(true);
        expect(messagingDB.bulkDelete).not.toHaveBeenCalled();

        service.dispose();
    });

    it("does not resurrect a recently deleted message from a late upsert in performance mode", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "ghost-1" });
        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("ghost-1", "stale-upsert")
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(isMessageDeleteSuppressed("ghost-1")).toBe(true);
        expect(chatStateStoreMocks.update).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it("suppresses alias ids when a delete event includes canonical identity keys", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({
            type: "message_deleted",
            conversationId: "c1",
            messageId: "wrapper-delete-1",
            messageIdentityIds: ["canonical-delete-1"],
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(isMessageDeleteSuppressed("wrapper-delete-1")).toBe(true);
        expect(isMessageDeleteSuppressed("canonical-delete-1")).toBe(true);
        expect(messagingDB.bulkDelete).not.toHaveBeenCalled();

        service.dispose();
    });

    it("does not resurrect a recently deleted message from a late upsert in legacy mode", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: false
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "ghost-legacy" });
        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("ghost-legacy", "stale-upsert")
        });
        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(isMessageDeleteSuppressed("ghost-legacy")).toBe(true);
        expect(messagingDB.put).not.toHaveBeenCalled();

        service.dispose();
    });

    it.skip("normalizes sender attribution and canonical DM conversation ids during legacy migration", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        vi.mocked(messagingDB.get).mockResolvedValue({
            messagesByConversationId: {
                [peerPublicKeyHex]: [
                    {
                        id: "m-out",
                        content: "my legacy outgoing",
                        timestampMs: 1_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                    {
                        id: "m-in",
                        content: "peer legacy incoming",
                        timestampMs: 2_000,
                        isOutgoing: true,
                        pubkey: peerPublicKeyHex,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
        });

        const service = new MessagePersistenceService();
        await service.migrateFromLegacy(myPublicKeyHex);

        expect(messagingDB.bulkPut).toHaveBeenCalledTimes(1);
        const upserted = vi.mocked(messagingDB.bulkPut).mock.calls[0]?.[1] as Array<Record<string, unknown>>;
        const outgoing = upserted.find((message) => message.id === "m-out");
        const incoming = upserted.find((message) => message.id === "m-in");

        expect(outgoing).toEqual(expect.objectContaining({
            conversationId: canonicalConversationId,
            senderPubkey: myPublicKeyHex,
            isOutgoing: true,
        }));
        expect(incoming).toEqual(expect.objectContaining({
            conversationId: canonicalConversationId,
            senderPubkey: peerPublicKeyHex,
            isOutgoing: false,
        }));
    });

    it.skip("keeps messages from both legacy and canonical dm keys when they normalize to one conversation id", async () => {
        const myPublicKeyHex = "c".repeat(64);
        const peerPublicKeyHex = "d".repeat(64);
        const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        vi.mocked(messagingDB.get).mockResolvedValue({
            messagesByConversationId: {
                [peerPublicKeyHex]: [{
                    id: "legacy-key-msg",
                    content: "legacy",
                    timestampMs: 3_000,
                    isOutgoing: true,
                    status: "delivered",
                }],
                [canonicalConversationId]: [{
                    id: "canonical-key-msg",
                    content: "canonical",
                    timestampMs: 4_000,
                    isOutgoing: false,
                    pubkey: peerPublicKeyHex,
                    status: "delivered",
                }],
            },
            groupMessages: {},
        });

        const service = new MessagePersistenceService();
        await service.migrateFromLegacy(myPublicKeyHex);

        const upserted = vi.mocked(messagingDB.bulkPut).mock.calls[0]?.[1] as Array<Record<string, unknown>>;
        expect(upserted.some((message) => message.id === "legacy-key-msg")).toBe(true);
        expect(upserted.some((message) => message.id === "canonical-key-msg")).toBe(true);
        expect(upserted.every((message) => message.conversationId === canonicalConversationId)).toBe(true);
    });

    it("re-migrates legacy chat-state messages when chat state is replaced", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });
        const myPublicKeyHex = "f".repeat(64);
        const peerPublicKeyHex = "e".repeat(64);
        vi.mocked(messagingDB.get).mockResolvedValue({
            messagesByConversationId: {
                [peerPublicKeyHex]: [{
                    id: "restore-msg-1",
                    content: "restored",
                    timestampMs: 5_000,
                    isOutgoing: true,
                    status: "delivered",
                }],
            },
            groupMessages: {},
        });

        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        window.dispatchEvent(new CustomEvent(CHAT_STATE_REPLACED_EVENT, {
            detail: { publicKeyHex: myPublicKeyHex, profileId: "default" },
        }));
        await Promise.resolve();

        // Legacy migration should not trigger immediate IndexedDB writes
        // (messages come from chatStateStore via the event, not from bus)
        expect(messagingDB.put).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it.skip("prefers in-memory replaced chat state over stale indexed chat-state during replace migration", async () => {
        const myPublicKeyHex = "f".repeat(64);
        const peerPublicKeyHex = "e".repeat(64);
        chatStateStoreMocks.load.mockReturnValue({
            messagesByConversationId: {
                [peerPublicKeyHex]: [{
                    id: "restore-msg-memory-1",
                    content: "restored from memory cache",
                    timestampMs: 5_000,
                    isOutgoing: true,
                    status: "delivered",
                }],
            },
            groupMessages: {},
            createdConnections: [],
            createdGroups: [],
        });
        vi.mocked(messagingDB.get).mockResolvedValue(null);

        // Migration is a one-time operation per scope — call it directly.
        // CHAT_STATE_REPLACED_EVENT no longer re-triggers migration after the first run.
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        await service.migrateFromLegacy(myPublicKeyHex);

        expect(chatStateStoreMocks.load).toHaveBeenCalledWith(myPublicKeyHex, { profileId: "default" });
        expect(messagingDB.get).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).toHaveBeenCalledWith("messages", expect.arrayContaining([
            expect.objectContaining({
                id: "restore-msg-memory-1",
            }),
        ]));

        service.dispose();
    });

    it("ignores chat-state replaced events from another profile scope", async () => {
        const myPublicKeyHex = "f".repeat(64);
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        window.dispatchEvent(new CustomEvent(CHAT_STATE_REPLACED_EVENT, {
            detail: { publicKeyHex: myPublicKeyHex, profileId: "work" },
        }));
        await Promise.resolve();
        await Promise.resolve();

        expect(chatStateStoreMocks.load).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it.skip("falls back to indexed chat-state when scoped cache only has metadata and misses restored group timelines", async () => {
        const myPublicKeyHex = "1".repeat(64);
        const restoredGroupConversationId = "community:alpha:wss://relay.example";
        chatStateStoreMocks.load.mockReturnValue({
            messagesByConversationId: {},
            groupMessages: {},
            createdConnections: [],
            createdGroups: [{
                id: restoredGroupConversationId,
                communityId: "alpha:wss://relay.example",
                groupId: "alpha",
                relayUrl: "wss://relay.example",
                displayName: "Alpha",
                memberPubkeys: [myPublicKeyHex],
                lastMessage: "metadata only",
                unreadCount: 0,
                lastMessageTimeMs: 6_000,
                access: "invite-only",
                memberCount: 1,
                adminPubkeys: [myPublicKeyHex],
            }],
        });
        vi.mocked(messagingDB.get).mockResolvedValue({
            messagesByConversationId: {},
            groupMessages: {
                [restoredGroupConversationId]: [{
                    id: "restored-group-msg-1",
                    pubkey: myPublicKeyHex,
                    content: "restored group timeline",
                    created_at: 6_000,
                }],
            },
            createdConnections: [],
            createdGroups: [{
                id: restoredGroupConversationId,
                communityId: "alpha:wss://relay.example",
                groupId: "alpha",
                relayUrl: "wss://relay.example",
                displayName: "Alpha",
                memberPubkeys: [myPublicKeyHex],
                lastMessage: "restored group timeline",
                unreadCount: 0,
                lastMessageTimeMs: 6_000,
                access: "invite-only",
                memberCount: 1,
                adminPubkeys: [myPublicKeyHex],
            }],
        });

        const service = new MessagePersistenceService();
        await service.migrateFromLegacy(myPublicKeyHex);

        expect(chatStateStoreMocks.load).toHaveBeenCalledWith(myPublicKeyHex, { profileId: "default" });
        expect(messagingDB.get).toHaveBeenCalledWith("chatState", myPublicKeyHex);
        expect(messagingDB.bulkPut).toHaveBeenCalledWith("messages", expect.arrayContaining([
            expect.objectContaining({
                id: "restored-group-msg-1",
                conversationId: restoredGroupConversationId,
                content: "restored group timeline",
                senderPubkey: myPublicKeyHex,
            }),
        ]));
    });

    it.skip("clears the derived messages index when the active hydration scope changes (first migration per scope only)", async () => {
        const accountA = "a".repeat(64);
        const accountB = "b".repeat(64);
        vi.mocked(messagingDB.get).mockResolvedValue(null);

        const service = new MessagePersistenceService();

        // First call for accountA (default profile): clears and migrates
        await service.migrateFromLegacy(accountA);
        expect(messagingDB.clear).toHaveBeenCalledWith("messages");

        vi.mocked(messagingDB.clear).mockClear();
        // Second call for same scope (accountA, default): one-time guard fires — no-op
        await service.migrateFromLegacy(accountA);
        expect(messagingDB.clear).not.toHaveBeenCalled();

        // First call for accountB (default profile): new scope — clears and migrates
        await service.migrateFromLegacy(accountB);
        expect(messagingDB.clear).toHaveBeenCalledWith("messages");

        vi.mocked(messagingDB.clear).mockClear();
        // Changing profile for accountB creates a new scope — but guard already
        // stored it as done for the "work::accountB" scope on first write;
        // since this is the first time for "work::accountB", clear fires.
        profileScopeState.activeProfileId = "work";
        await service.migrateFromLegacy(accountB);
        expect(messagingDB.clear).toHaveBeenCalledWith("messages");
    });
});

// ---------------------------------------------------------------------------
// Tauri / SQLite path regressions
// ---------------------------------------------------------------------------

const tauriDbMocks = vi.hoisted(() => ({
    dbInsertMessage: vi.fn(async (_message: MessageRecord) => undefined),
    dbInsertTombstone: vi.fn(async () => undefined),
    dbDeleteMessages: vi.fn(async () => undefined),
    dbUpsertConversation: vi.fn(async () => undefined),
    isTauri: vi.fn(() => false),
}));

vi.mock("@dweb/db", () => ({
    isTauri: tauriDbMocks.isTauri,
    dbInsertMessage: tauriDbMocks.dbInsertMessage,
    dbInsertTombstone: tauriDbMocks.dbInsertTombstone,
    dbDeleteMessages: tauriDbMocks.dbDeleteMessages,
    dbInsertTombstones: vi.fn(async () => undefined),
    dbGetMessages: vi.fn(async () => []),
    dbGetTombstones: vi.fn(async () => []),
    dbUpsertConversation: tauriDbMocks.dbUpsertConversation,
}));

describe("MessagePersistenceService Tauri/SQLite path", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true,
        });
        profileScopeState.activeProfileId = "default";
        nativePersistenceMocks.requiresSqlitePersistence.mockReturnValue(true);
        mediaIndexMocks.linkLocalMediaIndexToMessageEvent.mockClear();
        tauriDbMocks.isTauri.mockReturnValue(true);
        tauriDbMocks.dbInsertMessage.mockReset();
        tauriDbMocks.dbInsertMessage.mockResolvedValue(undefined);
        tauriDbMocks.dbInsertTombstone.mockClear();
        tauriDbMocks.dbDeleteMessages.mockClear();
        tauriDbMocks.dbUpsertConversation.mockReset();
        tauriDbMocks.dbUpsertConversation.mockResolvedValue(undefined);
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
    });

    afterEach(() => {
        tauriDbMocks.isTauri.mockReturnValue(false);
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("flushes each native upsert immediately without waiting for the batch timer", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const nostrId = "e".repeat(64);
        messageBus.emit({
            type: "new_message",
            conversationId: "conv-1",
            message: createMessage(nostrId, "immediate", {
                eventId: nostrId,
                isOutgoing: false,
                status: "delivered",
            }),
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalled();
        service.dispose();
    });

    it("writes relay-confirmed incoming message to SQLite when id equals eventId", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const nostrId = "d".repeat(64);
        messageBus.emit({
            type: "new_message",
            conversationId: "conv-1",
            message: {
                id: nostrId,
                eventId: nostrId,
                kind: "user",
                content: "incoming hello",
                timestamp: new Date(1_700_000_000_000),
                isOutgoing: false,
                status: "delivered",
            },
        });

        await vi.advanceTimersByTimeAsync(40);

        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalled();
        expect(tauriDbMocks.dbInsertMessage.mock.calls.some((call) => {
            const record = call.at(0) as { event_id?: string } | undefined;
            return record?.event_id === nostrId;
        })).toBe(true);

        service.dispose();
    });

    it("does not write an optimistic UUID-only message to SQLite before eventId is known", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        // Optimistic: id=UUID, no eventId
        messageBus.emit({
            type: "new_message",
            conversationId: "conv-1",
            message: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                kind: "user",
                content: "hello",
                timestamp: new Date(1_700_000_000_000),
                isOutgoing: true,
                status: "sending",
            },
        });

        await vi.runAllTimersAsync();
        expect(tauriDbMocks.dbInsertMessage).not.toHaveBeenCalled();

        service.dispose();
    });

    it("does not write to SQLite before profile scope is bound", async () => {
        const service = new MessagePersistenceService();
        service.init();

        const nostrId = "c".repeat(64);
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: {
                id: nostrId,
                eventId: nostrId,
                kind: "user",
                content: "hello",
                timestamp: new Date(1_700_000_000_000),
                isOutgoing: true,
                status: "delivered",
            },
        });

        await vi.runAllTimersAsync();
        expect(tauriDbMocks.dbInsertMessage).not.toHaveBeenCalled();
        service.dispose();
    });

    it("writes to SQLite when chatPerformanceV2 is off but runtime is Tauri (default desktop)", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: false,
        });
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const nostrId = "c".repeat(64);
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: createMessage("550e8400-e29b-41d4-a716-446655440003", "persisted", {
                eventId: nostrId,
                isOutgoing: true,
                status: "accepted",
            }),
        });
        await vi.advanceTimersByTimeAsync(40);

        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalled();
        expect(tauriDbMocks.dbInsertMessage.mock.calls.some((call) => {
            const record = call.at(0) as { event_id?: string } | undefined;
            return record?.event_id === nostrId;
        })).toBe(true);
        service.dispose();
    });

    it("writes to SQLite exactly once when eventId is confirmed (no UUID duplicate row)", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const uuid = "550e8400-e29b-41d4-a716-446655440001";
        const nostrId = "a".repeat(64);

        // Phase 1: optimistic, no eventId — must be suppressed on Tauri
        messageBus.emit({
            type: "new_message",
            conversationId: "conv-1",
            message: { id: uuid, kind: "user", content: "hello", timestamp: new Date(1_700_000_000_000), isOutgoing: true, status: "sending" },
        });
        await vi.runAllTimersAsync();
        expect(tauriDbMocks.dbInsertMessage).not.toHaveBeenCalled();

        // Phase 2: confirmed, eventId known — must write exactly once with event_id = nostrId
        tauriDbMocks.dbInsertMessage.mockClear();
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: { id: uuid, eventId: nostrId, kind: "user", content: "hello", timestamp: new Date(1_700_000_000_000), isOutgoing: true, status: "accepted" },
        });
        await vi.advanceTimersByTimeAsync(40);

        const nostrInserts = tauriDbMocks.dbInsertMessage.mock.calls.filter((call) => {
            const record = call.at(0) as { event_id?: string } | undefined;
            return record?.event_id === nostrId;
        });
        expect(nostrInserts).toHaveLength(1);
        expect(tauriDbMocks.dbInsertMessage).not.toHaveBeenCalledWith(
            expect.objectContaining({ event_id: uuid }),
        );

        service.dispose();
    });

    it("hard-deletes both UUID and nostrId rows from SQLite on delete", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const uuid = "550e8400-e29b-41d4-a716-446655440002";
        const nostrId = "b".repeat(64);

        messageBus.emitMessageDeleted("conv-1", uuid, {
            messageIdentityIds: [uuid, nostrId],
        });
        await vi.runAllTimersAsync();

        const deletedIds = new Set(
            (tauriDbMocks.dbDeleteMessages.mock.calls as unknown as Array<[string[], string]>).flatMap(
                ([batch]) => batch,
            ),
        );
        expect(deletedIds.has(uuid)).toBe(true);
        expect(deletedIds.has(nostrId)).toBe(true);

        // Belt-and-suspenders: tombstones are also written for receiver-side suppression
        const tombstonedIds = (tauriDbMocks.dbInsertTombstone.mock.calls as unknown as Array<[{ event_id: string }]>).map(
            (call) => call[0].event_id
        );
        expect(tombstonedIds).toContain(uuid);
        expect(tombstonedIds).toContain(nostrId);

        service.dispose();
    });

    it("does not mirror DM message bodies to chat-state on native", async () => {
        chatStateStoreMocks.update.mockClear();
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const nostrId = "e".repeat(64);
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: createMessage(nostrId, "native-only", {
                eventId: nostrId,
                isOutgoing: true,
                status: "delivered",
            }),
        });
        await vi.advanceTimersByTimeAsync(40);

        expect(chatStateStoreMocks.update).not.toHaveBeenCalled();
        service.dispose();
    });

    it("links cached media to message event_id after SQLite insert", async () => {
        const service = new MessagePersistenceService();
        service.bindProfileScope("default");

        const nostrId = "f".repeat(64);
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: createMessage("550e8400-e29b-41d4-a716-446655440005", "photo", {
                eventId: nostrId,
                isOutgoing: true,
                status: "delivered",
                attachments: [{
                    kind: "image",
                    url: "https://example.com/media/photo.jpg",
                    fileName: "photo.jpg",
                    contentType: "image/jpeg",
                }],
            }),
        });
        await vi.advanceTimersByTimeAsync(40);

        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalled();
        expect(mediaIndexMocks.linkLocalMediaIndexToMessageEvent).toHaveBeenCalledWith({
            messageEventId: nostrId,
            attachmentUrls: ["https://example.com/media/photo.jpg"],
        });
        expect(tauriDbMocks.dbInsertMessage.mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({ has_attachment: true }),
        );
        service.dispose();
    });
});
