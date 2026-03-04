import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { messageBus } from "./message-bus";
import { MessagePersistenceService } from "./message-persistence-service";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { messagingDB } from "@dweb/storage/indexed-db";

vi.mock("@dweb/storage/indexed-db", () => ({
    messagingDB: {
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        bulkPut: vi.fn(async () => undefined),
        bulkDelete: vi.fn(async () => undefined),
        get: vi.fn(async () => null),
    }
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
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.clearAllMocks();
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
});
