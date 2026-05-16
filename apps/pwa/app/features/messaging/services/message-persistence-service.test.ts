import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { messageBus } from "./message-bus";
import { MessagePersistenceService } from "./message-persistence-service";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { messagingDB } from "@dweb/storage/indexed-db";
import { CHAT_STATE_REPLACED_EVENT } from "./chat-state-store";
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
    removeMessageIdentities: vi.fn(),
    removeMessageIdentitiesFromAllActiveScopes: vi.fn(),
}));

const profileScopeState = vi.hoisted(() => ({
    activeProfileId: "default",
}));

vi.mock("./chat-state-store", () => ({
    CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
    chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
    readRegistryBackedActiveProfileId: () => profileScopeState.activeProfileId,
    getScopedStorageKey: (baseKey: string, profileId?: string) =>
        `${baseKey}::${profileId ?? profileScopeState.activeProfileId}`,
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

const createMessage = (id: string, content: string): Message => ({
    id,
    kind: "user",
    content,
    timestamp: new Date(1_700_000_000_000),
    isOutgoing: false,
    status: "delivered",
});

describe("MessagePersistenceService batching", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);
        clearMessageDeleteTombstones();
        profileScopeState.activeProfileId = "default";
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
        service.init();

        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("m-1", "old")
        });
        messageBus.emit({
            type: "message_updated",
            conversationId: "c1",
            message: createMessage("m-1", "new")
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(messagingDB.bulkPut).toHaveBeenCalledTimes(1);
        const upserted = vi.mocked(messagingDB.bulkPut).mock.calls[0]?.[1] as Array<Record<string, unknown>>;
        expect(upserted).toHaveLength(1);
        expect(upserted[0]?.id).toBe("m-1");
        expect(upserted[0]?.content).toBe("new");
        expect(messagingDB.put).not.toHaveBeenCalled();

        service.dispose();
    });

    it("keeps legacy immediate writes when performance mode is disabled", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: false
        });

        const service = new MessagePersistenceService();
        service.init();

        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("m-legacy", "legacy")
        });
        await Promise.resolve();

        expect(messagingDB.put).toHaveBeenCalledTimes(1);
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it("groups multiple deletes into one bulk delete flush", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.init();

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "d-1" });
        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "d-2" });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(messagingDB.bulkDelete).toHaveBeenCalledTimes(1);
        const deleted = [...(vi.mocked(messagingDB.bulkDelete).mock.calls[0]?.[1] ?? [])].sort();
        expect(deleted).toEqual(["d-1", "d-2"]);
        expect(isMessageDeleteSuppressed("d-1")).toBe(true);
        expect(messagingDB.delete).not.toHaveBeenCalled();

        service.dispose();
    });

    it("does not resurrect a recently deleted message from a late upsert in performance mode", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.init();

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "ghost-1" });
        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("ghost-1", "stale-upsert")
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(messagingDB.bulkDelete).toHaveBeenCalledTimes(1);
        const deleted = vi.mocked(messagingDB.bulkDelete).mock.calls[0]?.[1] as Array<string>;
        expect(deleted).toContain("ghost-1");
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it("suppresses alias ids when a delete event includes canonical identity keys", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });

        const service = new MessagePersistenceService();
        service.init();

        messageBus.emit({
            type: "message_deleted",
            conversationId: "c1",
            messageId: "wrapper-delete-1",
            messageIdentityIds: ["canonical-delete-1"],
        });

        await vi.advanceTimersByTimeAsync(40);
        await Promise.resolve();

        expect(messagingDB.bulkDelete).toHaveBeenCalledTimes(1);
        const deleted = [...(vi.mocked(messagingDB.bulkDelete).mock.calls[0]?.[1] ?? [])].sort();
        expect(deleted).toEqual(["canonical-delete-1", "wrapper-delete-1"]);
        expect(isMessageDeleteSuppressed("wrapper-delete-1")).toBe(true);
        expect(isMessageDeleteSuppressed("canonical-delete-1")).toBe(true);

        service.dispose();
    });

    it("does not resurrect a recently deleted message from a late upsert in legacy mode", async () => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: false
        });

        const service = new MessagePersistenceService();
        service.init();

        messageBus.emit({ type: "message_deleted", conversationId: "c1", messageId: "ghost-legacy" });
        messageBus.emit({
            type: "new_message",
            conversationId: "c1",
            message: createMessage("ghost-legacy", "stale-upsert")
        });
        await Promise.resolve();

        expect(messagingDB.delete).toHaveBeenCalledTimes(1);
        expect(messagingDB.put).not.toHaveBeenCalled();

        service.dispose();
    });

    it("normalizes sender attribution and canonical DM conversation ids during legacy migration", async () => {
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

    it("keeps messages from both legacy and canonical dm keys when they normalize to one conversation id", async () => {
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
        service.init();

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

    it("prefers in-memory replaced chat state over stale indexed chat-state during replace migration", async () => {
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
        service.init();

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
        service.init();

        window.dispatchEvent(new CustomEvent(CHAT_STATE_REPLACED_EVENT, {
            detail: { publicKeyHex: myPublicKeyHex, profileId: "work" },
        }));
        await Promise.resolve();
        await Promise.resolve();

        expect(chatStateStoreMocks.load).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).not.toHaveBeenCalled();

        service.dispose();
    });

    it("falls back to indexed chat-state when scoped cache only has metadata and misses restored group timelines", async () => {
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

    it("clears the derived messages index when the active hydration scope changes (first migration per scope only)", async () => {
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
    dbInsertMessage: vi.fn(async () => undefined),
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
        tauriDbMocks.isTauri.mockReturnValue(true);
        tauriDbMocks.dbInsertMessage.mockClear();
        tauriDbMocks.dbInsertTombstone.mockClear();
        tauriDbMocks.dbDeleteMessages.mockClear();
        tauriDbMocks.dbUpsertConversation.mockClear();
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
    });

    afterEach(() => {
        tauriDbMocks.isTauri.mockReturnValue(false);
        Object.keys(localStorage).filter(k => k.startsWith("obscur:msg_migration_done::")).forEach(k => localStorage.removeItem(k));
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("does not write an optimistic UUID-only message to SQLite before eventId is known", async () => {
        const service = new MessagePersistenceService();
        service.init();

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

    it("writes to SQLite exactly once when eventId is confirmed (no UUID duplicate row)", async () => {
        const service = new MessagePersistenceService();
        service.init();

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
        messageBus.emit({
            type: "message_updated",
            conversationId: "conv-1",
            message: { id: uuid, eventId: nostrId, kind: "user", content: "hello", timestamp: new Date(1_700_000_000_000), isOutgoing: true, status: "accepted" },
        });
        await vi.runAllTimersAsync();

        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalledTimes(1);
        expect(tauriDbMocks.dbInsertMessage).toHaveBeenCalledWith(
            expect.objectContaining({ event_id: nostrId })
        );

        service.dispose();
    });

    it("hard-deletes both UUID and nostrId rows from SQLite on delete", async () => {
        const service = new MessagePersistenceService();
        service.init();

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
});
