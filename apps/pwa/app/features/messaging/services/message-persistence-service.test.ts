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
        get: vi.fn(async () => null),
    }
}));

const chatStateStoreMocks = vi.hoisted(() => ({
    load: vi.fn(),
}));

vi.mock("./chat-state-store", () => ({
    CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
    chatStateStoreService: chatStateStoreMocks,
}));

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
    });

    afterEach(() => {
        clearMessageDeleteTombstones();
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
            detail: { publicKeyHex: myPublicKeyHex },
        }));
        await Promise.resolve();
        await Promise.resolve();

        expect(messagingDB.bulkPut).toHaveBeenCalled();
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

        const service = new MessagePersistenceService();
        service.init();

        window.dispatchEvent(new CustomEvent(CHAT_STATE_REPLACED_EVENT, {
            detail: { publicKeyHex: myPublicKeyHex },
        }));
        await Promise.resolve();
        await Promise.resolve();

        expect(chatStateStoreMocks.load).toHaveBeenCalledWith(myPublicKeyHex);
        expect(messagingDB.get).not.toHaveBeenCalled();
        expect(messagingDB.bulkPut).toHaveBeenCalledWith("messages", expect.arrayContaining([
            expect.objectContaining({
                id: "restore-msg-memory-1",
            }),
        ]));

        service.dispose();
    });
});
