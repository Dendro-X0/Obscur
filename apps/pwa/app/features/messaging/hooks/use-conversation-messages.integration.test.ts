import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageBus } from "../services/message-bus";
import { useConversationMessages } from "./use-conversation-messages";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";

vi.mock("@dweb/storage/indexed-db", () => ({
    messagingDB: {
        getAllByIndex: vi.fn(async () => []),
    }
}));

const createMessage = (params: Readonly<{ id: string; timestampMs: number; content?: string }>) => ({
    id: params.id,
    kind: "user" as const,
    content: params.content ?? params.id,
    timestamp: new Date(params.timestampMs),
    isOutgoing: false,
    status: "delivered" as const,
});

describe("useConversationMessages integration (perf mode)", () => {
    beforeEach(() => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });
        vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);

        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => {
            return setTimeout(() => cb(performance.now()), 0) as unknown as number;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
            clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
        });

        if (!(globalThis as Record<string, unknown>).IDBKeyRange) {
            (globalThis as Record<string, unknown>).IDBKeyRange = {
                bound: () => ({})
            };
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("batches a DM burst of 100 incoming events into one frame-applied state update", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-burst", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            for (let i = 0; i < 100; i += 1) {
                messageBus.emitNewMessage("c-burst", createMessage({ id: `m-${i}`, timestampMs: 1_000 + i }));
            }
        });

        await waitFor(() => expect(result.current.messages.length).toBe(100));
        expect(result.current.messages[0]?.id).toBe("m-0");
        expect(result.current.messages[99]?.id).toBe("m-99");
        unmount();
    });

    it("applies mixed new/update/delete for same ids correctly within one flush window", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-mixed", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            messageBus.emitNewMessage("c-mixed", createMessage({ id: "m1", timestampMs: 1_000, content: "old" }));
            messageBus.emitMessageUpdated("c-mixed", createMessage({ id: "m1", timestampMs: 1_001, content: "new" }));
            messageBus.emitMessageDeleted("c-mixed", "m1");
            messageBus.emitNewMessage("c-mixed", createMessage({ id: "m2", timestampMs: 1_002, content: "alive" }));
        });

        await waitFor(() => expect(result.current.messages.length).toBe(1));
        expect(result.current.messages[0]?.id).toBe("m2");
        expect(result.current.messages[0]?.content).toBe("alive");
        unmount();
    });

    it("enforces 120 live-window cap during heavy incoming flow", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-window", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            for (let i = 0; i < 200; i += 1) {
                messageBus.emitNewMessage("c-window", createMessage({ id: `w-${i}`, timestampMs: 2_000 + i }));
            }
        });

        await waitFor(() => expect(result.current.messages.length).toBe(120));
        expect(result.current.messages[0]?.id).toBe("w-80");
        expect(result.current.messages[119]?.id).toBe("w-199");
        unmount();
    });

    it("prevents deleted messages from reappearing when a stale upsert arrives later", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-tombstone", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            messageBus.emitNewMessage("c-tombstone", createMessage({ id: "t1", timestampMs: 10_000, content: "first" }));
        });
        await waitFor(() => expect(result.current.messages.length).toBe(1));

        act(() => {
            messageBus.emitMessageDeleted("c-tombstone", "t1");
        });
        await waitFor(() => expect(result.current.messages.length).toBe(0));

        act(() => {
            messageBus.emitNewMessage("c-tombstone", createMessage({ id: "t1", timestampMs: 9_000, content: "stale-replay" }));
            messageBus.emitNewMessage("c-tombstone", createMessage({ id: "t2", timestampMs: 11_000, content: "fresh" }));
        });

        await waitFor(() => expect(result.current.messages.length).toBe(1));
        expect(result.current.messages[0]?.id).toBe("t2");
        unmount();
    });
});
