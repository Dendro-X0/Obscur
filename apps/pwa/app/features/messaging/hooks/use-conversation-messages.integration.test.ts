import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messageBus } from "../services/message-bus";
import { useConversationMessages } from "./use-conversation-messages";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { messagingDB } from "@dweb/storage/indexed-db";
import { clearMessageDeleteTombstones } from "../services/message-delete-tombstone-store";

const accountProjectionSnapshot = {
    profileId: "default",
    accountPublicKeyHex: "a".repeat(64),
    projection: null as any,
    phase: "ready",
    status: "ready",
    accountProjectionReady: true,
    driftStatus: "clean",
    updatedAtUnixMs: Date.now(),
};

const chatStateStoreMocks = vi.hoisted(() => ({
    load: vi.fn(() => null),
}));

const telemetryMocks = vi.hoisted(() => ({
    logAppEvent: vi.fn(),
}));

const projectionReadAuthorityState = vi.hoisted((): {
    useProjectionReads: boolean;
    reason: "read_cutover_enabled" | "shadow_mode";
    policyPhase: "read_cutover" | "shadow";
    criticalDriftCount: number;
} => ({
    useProjectionReads: true,
    reason: "read_cutover_enabled",
    policyPhase: "read_cutover",
    criticalDriftCount: 0,
}));

vi.mock("@dweb/storage/indexed-db", () => ({
    messagingDB: {
        getAllByIndex: vi.fn(async () => []),
    }
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
    useAccountProjectionSnapshot: () => accountProjectionSnapshot,
}));

vi.mock("@/app/features/account-sync/services/account-projection-read-authority", () => ({
    resolveProjectionReadAuthority: () => ({
        useProjectionReads: projectionReadAuthorityState.useProjectionReads,
        reason: projectionReadAuthorityState.reason,
        policy: {
            phase: projectionReadAuthorityState.policyPhase,
            rollbackEnabled: true,
            updatedAtUnixMs: Date.now(),
        },
        criticalDriftCount: projectionReadAuthorityState.criticalDriftCount,
    }),
}));

vi.mock("../services/chat-state-store", () => ({
    CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
    chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/shared/log-app-event", () => ({
    logAppEvent: telemetryMocks.logAppEvent,
}));

const createMessage = (params: Readonly<{ id: string; timestampMs: number; content?: string; eventId?: string }>) => ({
    id: params.id,
    kind: "user" as const,
    content: params.content ?? params.id,
    timestamp: new Date(params.timestampMs),
    isOutgoing: false,
    status: "delivered" as const,
    ...(params.eventId ? { eventId: params.eventId } : {}),
});

describe("useConversationMessages integration (perf mode)", () => {
    beforeEach(() => {
        vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
            ...defaultPrivacySettings,
            chatPerformanceV2: true
        });
        vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);
        clearMessageDeleteTombstones();
        accountProjectionSnapshot.projection = null;
        chatStateStoreMocks.load.mockReset();
        chatStateStoreMocks.load.mockReturnValue(null);
        telemetryMocks.logAppEvent.mockReset();
        projectionReadAuthorityState.useProjectionReads = true;
        projectionReadAuthorityState.reason = "read_cutover_enabled";
        projectionReadAuthorityState.policyPhase = "read_cutover";
        projectionReadAuthorityState.criticalDriftCount = 0;
        accountProjectionSnapshot.phase = "ready";
        accountProjectionSnapshot.status = "ready";
        accountProjectionSnapshot.accountProjectionReady = true;

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
        clearMessageDeleteTombstones();
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

    it("enforces 200 live-window cap during heavy incoming flow", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-window", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            for (let i = 0; i < 200; i += 1) {
                messageBus.emitNewMessage("c-window", createMessage({ id: `w-${i}`, timestampMs: 2_000 + i }));
            }
        });

        await waitFor(() => expect(result.current.messages.length).toBe(200));
        expect(result.current.messages[0]?.id).toBe("w-0");
        expect(result.current.messages[199]?.id).toBe("w-199");
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

    it("suppresses stale replays that return under an alternate event id after deletion", async () => {
        const { result, unmount } = renderHook(() => useConversationMessages("c-alias-tombstone", null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            messageBus.emitNewMessage("c-alias-tombstone", createMessage({
                id: "alias-local-1",
                eventId: "alias-event-1",
                timestampMs: 12_000,
                content: "first",
            }));
        });
        await waitFor(() => expect(result.current.messages.length).toBe(1));

        act(() => {
            messageBus.emitMessageDeleted("c-alias-tombstone", "alias-event-1");
        });
        await waitFor(() => expect(result.current.messages.length).toBe(0));

        act(() => {
            messageBus.emitNewMessage("c-alias-tombstone", createMessage({
                id: "alias-local-2",
                eventId: "alias-event-1",
                timestampMs: 12_500,
                content: "stale-event-replay",
            }));
            messageBus.emitNewMessage("c-alias-tombstone", createMessage({
                id: "alias-local-3",
                eventId: "alias-event-3",
                timestampMs: 13_000,
                content: "fresh",
            }));
        });

        await waitFor(() => expect(result.current.messages.length).toBe(1));
        expect(result.current.messages[0]?.id).toBe("alias-local-3");
        unmount();
    });

    it("hydrates from projection timeline when local indexeddb has no messages", async () => {
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: "a".repeat(64),
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                "c-projection": [
                    {
                        messageId: "p1",
                        conversationId: "c-projection",
                        peerPublicKeyHex: "b".repeat(64),
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 10,
                        plaintextPreview: "hello from projection",
                        observedAtUnixMs: 10_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 1,
            updatedAtUnixMs: 10_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages("c-projection", "a".repeat(64)));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.id).toBe("p1");
        expect(result.current.messages[0]?.content).toBe("hello from projection");
        expect(result.current.hasEarlier).toBe(false);
        unmount();
    });

    it("does not rehydrate indexed history when projection updates for the same conversation", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "idx-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed-one",
                timestampMs: 10_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);

        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        messageId: "projection-1",
                        conversationId,
                        peerPublicKeyHex,
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 11,
                        plaintextPreview: "projection-one",
                        observedAtUnixMs: 11_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 11,
            updatedAtUnixMs: 11_000,
        };

        const { result, rerender, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() => expect(result.current.messages.some((message) => message.id === "projection-1")).toBe(true));
        const initialIndexedReadCallCount = vi.mocked(messagingDB.getAllByIndex).mock.calls.length;
        expect(initialIndexedReadCallCount).toBeGreaterThan(0);

        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        messageId: "projection-2",
                        conversationId,
                        peerPublicKeyHex,
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 12,
                        plaintextPreview: "projection-two",
                        observedAtUnixMs: 12_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 12,
            updatedAtUnixMs: 12_000,
        };

        rerender();
        await waitFor(() => expect(result.current.messages.some((message) => message.id === "projection-2")).toBe(true));
        expect(vi.mocked(messagingDB.getAllByIndex).mock.calls.length).toBe(initialIndexedReadCallCount);
        unmount();
    });

    it("does not resurrect projection-backed messages after local delete and remount", async () => {
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: "a".repeat(64),
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                "c-projection-delete": [
                    {
                        messageId: "p-delete-1",
                        conversationId: "c-projection-delete",
                        peerPublicKeyHex: "b".repeat(64),
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 10,
                        plaintextPreview: "projection message",
                        observedAtUnixMs: 10_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 1,
            updatedAtUnixMs: 10_000,
        };

        const first = renderHook(() => useConversationMessages("c-projection-delete", "a".repeat(64)));
        await waitFor(() => expect(first.result.current.isLoading).toBe(false));
        expect(first.result.current.messages).toHaveLength(1);

        act(() => {
            messageBus.emitMessageDeleted("c-projection-delete", "p-delete-1");
        });
        await waitFor(() => expect(first.result.current.messages).toHaveLength(0));
        first.unmount();

        const second = renderHook(() => useConversationMessages("c-projection-delete", "a".repeat(64)));
        await waitFor(() => expect(second.result.current.isLoading).toBe(false));
        expect(second.result.current.messages).toHaveLength(0);
        second.unmount();
    });

    it("derives media attachments from projection plaintext when attachment metadata is missing", async () => {
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: "a".repeat(64),
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                "c-projection-media": [
                    {
                        messageId: "p-media-1",
                        conversationId: "c-projection-media",
                        peerPublicKeyHex: "b".repeat(64),
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 10,
                        plaintextPreview: "photo [avatar.jpg](https://image.nostr.build/avatar.jpg)",
                        observedAtUnixMs: 10_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 1,
            updatedAtUnixMs: 10_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages("c-projection-media", "a".repeat(64)));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.attachments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: "image",
                url: "https://image.nostr.build/avatar.jpg",
            }),
        ]));
        unmount();
    });

    it("normalizes legacy indexed records that only persisted pubkey metadata", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValueOnce([
            {
                id: "legacy-in",
                conversationId,
                pubkey: peerPublicKeyHex,
                content: "incoming legacy",
                timestampMs: 1_000,
                isOutgoing: false,
                status: "delivered",
            },
            {
                id: "legacy-out",
                conversationId,
                content: "outgoing legacy",
                timestampMs: 2_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const inbound = result.current.messages.find((message) => message.id === "legacy-in");
        const outbound = result.current.messages.find((message) => message.id === "legacy-out");
        expect(inbound?.senderPubkey).toBe(peerPublicKeyHex);
        expect(outbound?.senderPubkey).toBe(myPublicKeyHex);
        expect(outbound?.recipientPubkey).toBe(peerPublicKeyHex);
        unmount();
    });

    it("derives media attachments from indexed message content when attachment metadata is missing", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValueOnce([
            {
                id: "legacy-media-1",
                conversationId,
                pubkey: peerPublicKeyHex,
                content: "clip [test.mp4](https://video.nostr.build/test.mp4)",
                timestampMs: 1_000,
                isOutgoing: false,
                status: "delivered",
            },
        ] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.attachments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: "video",
                url: "https://video.nostr.build/test.mp4",
            }),
        ]));
        unmount();
    });

    it("prefers projection as the single authority even when indexed history exists", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        const indexedMessages = Array.from({ length: 200 }, (_, index) => ({
            id: `idx-${index}`,
            conversationId,
            senderPubkey: myPublicKeyHex,
            recipientPubkey: peerPublicKeyHex,
            content: `indexed-${index}`,
            timestampMs: 10_000 + index,
            isOutgoing: true,
            status: "delivered",
        }));
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValueOnce(indexedMessages as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        messageId: "projection-extra-1",
                        conversationId,
                        peerPublicKeyHex,
                        direction: "incoming",
                        eventCreatedAtUnixSeconds: 30,
                        plaintextPreview: "projection-extra",
                        observedAtUnixMs: 30_000,
                    },
                ],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 2,
            updatedAtUnixMs: 30_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() => expect(result.current.messages.length).toBe(1));
        expect(result.current.messages[0]?.id).toBe("projection-extra-1");
        expect(result.current.hasEarlier).toBe(false);
        unmount();
    });

    it("hydrates up to the latest visible 200-message window when newest page is mostly hidden command rows", async () => {
        const conversationId = "c-sparse-visible-window";
        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        const newestVisibleRow = {
            id: "safe-latest",
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: "safe-latest",
            timestampMs: 1_000,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        };
        const newestCommandRows = Array.from({ length: 199 }, (_, index) => ({
            id: `cmd-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: `__dweb_cmd__${index + 1}`,
            timestampMs: 999 - index,
            isOutgoing: false,
            status: "delivered",
            kind: "command",
        }));
        const olderDisplayRows = Array.from({ length: 200 }, (_, index) => ({
            id: `older-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: `older-visible-${index + 1}`,
            timestampMs: 800 - index,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        }));

        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const upperTimestampMs = Number(range?.upper?.[1] ?? Number.NaN);
            if (!Number.isFinite(upperTimestampMs) || upperTimestampMs >= 1_000) {
                return [newestVisibleRow, ...newestCommandRows] as any;
            }
            if (upperTimestampMs >= 800) {
                return olderDisplayRows as any;
            }
            return [];
        });

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages.length).toBe(200);
        expect(result.current.hasEarlier).toBe(true);
        expect(result.current.messages.some((message) => message.id === "safe-latest")).toBe(true);
        expect(result.current.messages.some((message) => message.id === "older-1")).toBe(true);
        expect(result.current.messages.some((message) => message.id === "older-200")).toBe(false);
        expect(vi.mocked(messagingDB.getAllByIndex).mock.calls.length).toBeGreaterThanOrEqual(2);
        unmount();
    });

    it("continues sparse-window hydration when malformed rows have zero timestamps", async () => {
        const conversationId = "c-malformed-sparse-window";
        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        const newestVisibleRow = {
            id: "safe-newest",
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: "safe-newest",
            timestampMs: 1_000,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        };
        const malformedRows = Array.from({ length: 199 }, (_, index) => ({
            id: `malformed-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: `__dweb_cmd__malformed-${index + 1}`,
            isOutgoing: false,
            status: "delivered",
            kind: "command",
        }));
        const olderDisplayRows = Array.from({ length: 30 }, (_, index) => ({
            id: `older-valid-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: `older-valid-${index + 1}`,
            timestampMs: 900 - index,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        }));

        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const upperTimestampMs = Number(range?.upper?.[1] ?? Number.NaN);
            if (!Number.isFinite(upperTimestampMs) || upperTimestampMs >= 1_000) {
                return [newestVisibleRow, ...malformedRows] as any;
            }
            if (upperTimestampMs >= 900) {
                return olderDisplayRows as any;
            }
            return [];
        });

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages.length).toBeGreaterThan(1);
        expect(result.current.messages.some((message) => message.id === "safe-newest")).toBe(true);
        expect(result.current.messages.some((message) => message.id === "older-valid-1")).toBe(true);
        expect(vi.mocked(messagingDB.getAllByIndex).mock.calls.length).toBeGreaterThanOrEqual(2);
        unmount();
    });

    it("filters hidden voice-call-signal payload rows from hydration so timeline is not blank", async () => {
        const conversationId = "c-hidden-signal-window";
        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        const hiddenSignalRows = Array.from({ length: 200 }, (_, index) => ({
            id: `signal-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: JSON.stringify({
                type: "voice-call-signal",
                roomId: "room-1",
                signalType: "leave",
                sentAtUnixMs: 5_000 + index,
            }),
            timestampMs: 5_000 + index,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        }));
        const olderDisplayRows = Array.from({ length: 12 }, (_, index) => ({
            id: `older-user-${index + 1}`,
            conversationId,
            senderPubkey: "b".repeat(64),
            recipientPubkey: "a".repeat(64),
            content: `older-user-${index + 1}`,
            timestampMs: 4_000 - index,
            isOutgoing: false,
            status: "delivered",
            kind: "user",
        }));

        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const upperTimestampMs = Number(range?.upper?.[1] ?? Number.NaN);
            if (!Number.isFinite(upperTimestampMs) || upperTimestampMs >= 5_000) {
                return hiddenSignalRows as any;
            }
            if (upperTimestampMs >= 4_000) {
                return olderDisplayRows as any;
            }
            return [];
        });

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, null));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages.length).toBe(12);
        expect(result.current.messages.some((message) => message.id === "older-user-1")).toBe(true);
        expect(result.current.messages.some((message) => message.id.startsWith("signal-"))).toBe(false);
        unmount();
    });

    it("keeps the live conversation window capped at 200 when projection is the selected authority", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        const indexedMessages = Array.from({ length: 200 }, (_, index) => ({
            id: `idx-${index}`,
            conversationId,
            senderPubkey: myPublicKeyHex,
            recipientPubkey: peerPublicKeyHex,
            content: `indexed-${index}`,
            timestampMs: 20_000 + index,
            isOutgoing: true,
            status: "delivered",
        }));
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValueOnce(indexedMessages as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: Array.from({ length: 900 }, (_, index) => ({
                    messageId: `projection-${index + 1}`,
                    conversationId,
                    peerPublicKeyHex,
                    direction: index % 2 === 0 ? "incoming" : "outgoing",
                    eventCreatedAtUnixSeconds: index + 1,
                    plaintextPreview: `projection-${index + 1}`,
                    observedAtUnixMs: (index + 1) * 1_000,
                })),
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 3,
            updatedAtUnixMs: 900_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() => expect(result.current.messages.length).toBe(200));
        expect(result.current.hasEarlier).toBe(false);
        unmount();
    });

    it("accepts realtime DM events from canonical sibling ids when mounted on legacy peer conversation id", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const legacyConversationId = peerPublicKeyHex;
        const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        const { result, unmount } = renderHook(() => useConversationMessages(legacyConversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            messageBus.emitNewMessage(
                canonicalConversationId,
                createMessage({ id: "alias-live-1", timestampMs: 42_000, content: "live inbound" }),
            );
        });
        await waitFor(() => expect(result.current.messages.some((message) => message.id === "alias-live-1")).toBe(true));

        act(() => {
            messageBus.emitMessageDeleted(canonicalConversationId, "alias-live-1");
        });
        await waitFor(() => expect(result.current.messages.some((message) => message.id === "alias-live-1")).toBe(false));
        unmount();
    });

    it("hydrates DM history from canonical sibling ids when selected conversation uses legacy peer id", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const legacyConversationId = peerPublicKeyHex;
        const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const requestedConversationId = range?.lower?.[0];
            if (requestedConversationId === canonicalConversationId) {
                return [
                    {
                        id: "alias-hydrated-1",
                        conversationId: canonicalConversationId,
                        senderPubkey: peerPublicKeyHex,
                        recipientPubkey: myPublicKeyHex,
                        content: "stored on canonical key",
                        timestampMs: 43_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                ];
            }
            return [];
        });

        const { result, unmount } = renderHook(() => useConversationMessages(legacyConversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.messages.some((message) => message.id === "alias-hydrated-1")).toBe(true);

        const requestedConversationIds = vi.mocked(messagingDB.getAllByIndex).mock.calls
            .map((call) => (call[2] as any)?.lower?.[0])
            .filter((value): value is string => typeof value === "string");
        expect(requestedConversationIds).toContain(canonicalConversationId);
        unmount();
    });

    it("rehydrates an already-open conversation when restore replaces chat state after an empty first load", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        let restoreApplied = false;

        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const requestedConversationId = range?.lower?.[0];
            if (requestedConversationId !== conversationId) {
                return [];
            }
            if (!restoreApplied) {
                return [];
            }
            return [{
                id: "late-restore-1",
                conversationId,
                senderPubkey: peerPublicKeyHex,
                recipientPubkey: myPublicKeyHex,
                content: "restored after replace",
                timestampMs: 50_000,
                isOutgoing: false,
                status: "delivered",
            }] as any;
        });

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.messages).toHaveLength(0);

        restoreApplied = true;
        act(() => {
            window.dispatchEvent(new CustomEvent("obscur:chat-state-replaced", {
                detail: { publicKeyHex: myPublicKeyHex },
            }));
        });

        await waitFor(() => expect(result.current.messages.some((message) => message.id === "late-restore-1")).toBe(true));
        expect(vi.mocked(messagingDB.getAllByIndex).mock.calls.length).toBeGreaterThanOrEqual(2);
        unmount();
    });

    it("falls back to persisted chat-state conversation history when the messages index is empty", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [{
                    id: "persisted-fallback-1",
                    eventId: "persisted-fallback-evt-1",
                    pubkey: peerPublicKeyHex,
                    content: "restored from chat state",
                    timestampMs: 61_000,
                    isOutgoing: false,
                    status: "delivered",
                }],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toHaveLength(1);
        expect(result.current.messages[0]?.id).toBe("persisted-fallback-1");
        expect(result.current.messages[0]?.content).toBe("restored from chat state");
        unmount();
    });

    it("keeps projection as the long-term authority in read cutover even when persisted fallback remains available", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [{
                    id: "persisted-fallback-1",
                    eventId: "persisted-fallback-evt-1",
                    pubkey: peerPublicKeyHex,
                    content: "persisted restore",
                    timestampMs: 61_000,
                    isOutgoing: false,
                    status: "delivered",
                }],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([] as any);

        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [{
                    messageId: "projection-cutover-1",
                    conversationId,
                    peerPublicKeyHex,
                    direction: "incoming",
                    eventCreatedAtUnixSeconds: 62,
                    plaintextPreview: "projection read cutover",
                    observedAtUnixMs: 62_000,
                }],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 62,
            updatedAtUnixMs: 62_000,
        };

        const { result, rerender, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await waitFor(() => expect(result.current.messages[0]?.id).toBe("projection-cutover-1"));

        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [{
                    messageId: "projection-cutover-2",
                    conversationId,
                    peerPublicKeyHex,
                    direction: "incoming",
                    eventCreatedAtUnixSeconds: 63,
                    plaintextPreview: "projection update",
                    observedAtUnixMs: 63_000,
                }],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 63,
            updatedAtUnixMs: 63_000,
        };

        rerender();
        await waitFor(() => expect(result.current.messages.some((message) => message.id === "projection-cutover-2")).toBe(true));
        expect(result.current.messages.some((message) => message.content === "projection update")).toBe(true);
        expect(result.current.messages.some((message) => message.id === "persisted-fallback-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "projection",
                selectedAuthorityReason: "projection_read_cutover",
                persistedFallbackMessageCount: 1,
                projectionMessageCount: 1,
                projectionReadAuthorityReason: "read_cutover_enabled",
            }),
        }));
        unmount();
    });

    it("chooses persisted history as the single authority when restore-phase indexed history is outgoing-only", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "bootstrapping";
        accountProjectionSnapshot.status = "pending";
        accountProjectionSnapshot.accountProjectionReady = false;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-incoming-1",
                        eventId: "persisted-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "peer restored message",
                        timestampMs: 60_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-outgoing-1",
                        eventId: "persisted-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "self restored message",
                        timestampMs: 61_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-outgoing-only-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self only",
                timestampMs: 61_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "persisted-incoming-1",
                isOutgoing: false,
                content: "peer restored message",
            }),
            expect.objectContaining({
                id: "persisted-outgoing-1",
                isOutgoing: true,
                content: "self restored message",
            }),
        ]);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "persisted",
                selectedAuthorityReason: "persisted_recovery_indexed_missing_incoming",
                projectionEvidenceIncomingCount: 0,
                projectionBootstrapImportApplied: false,
                projectionCanonicalEvidencePending: true,
                persistedCompatibilityRestorePhaseIncomingRepairCandidate: true,
                persistedCompatibilityRestorePhaseIncomingRepairReasonCode: "persisted_compatibility_restore_phase_missing_incoming",
                indexedThinnessEvidenceForPersistedIncomingRepair: true,
                projectionReadAuthorityReason: "shadow_mode",
            }),
        }));
        unmount();
    });

    it("keeps indexed alias history authoritative in read cutover when alias rows already cover both directions", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const legacyConversationId = peerPublicKeyHex;
        const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [legacyConversationId]: [{
                    id: "persisted-legacy-only-1",
                    eventId: "persisted-legacy-only-evt-1",
                    pubkey: peerPublicKeyHex,
                    content: "persisted fallback should stay secondary",
                    timestampMs: 71_000,
                    isOutgoing: false,
                    status: "delivered",
                }],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);

        vi.stubGlobal("IDBKeyRange", {
            bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
        });
        vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
            const requestedConversationId = range?.lower?.[0];
            if (requestedConversationId === legacyConversationId) {
                return [{
                    id: "indexed-legacy-incoming-1",
                    conversationId: legacyConversationId,
                    senderPubkey: peerPublicKeyHex,
                    recipientPubkey: myPublicKeyHex,
                    content: "legacy incoming",
                    timestampMs: 70_000,
                    isOutgoing: false,
                    status: "delivered",
                }] as any;
            }
            if (requestedConversationId === canonicalConversationId) {
                return [{
                    id: "indexed-canonical-outgoing-1",
                    conversationId: canonicalConversationId,
                    senderPubkey: myPublicKeyHex,
                    recipientPubkey: peerPublicKeyHex,
                    content: "canonical outgoing",
                    timestampMs: 72_000,
                    isOutgoing: true,
                    status: "delivered",
                }] as any;
            }
            return [] as any;
        });

        const { result, unmount } = renderHook(() => useConversationMessages(legacyConversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "indexed-legacy-incoming-1",
                content: "legacy incoming",
            }),
            expect.objectContaining({
                id: "indexed-canonical-outgoing-1",
                content: "canonical outgoing",
            }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-legacy-only-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                indexedMessageCount: 2,
                indexedOutgoingCount: 1,
                indexedIncomingCount: 1,
                persistedFallbackMessageCount: 1,
                projectionReadAuthorityReason: "read_cutover_enabled",
            }),
        }));
        unmount();
    });

    it("keeps indexed history authoritative in shadow mode when projection already has incoming evidence", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "ready";
        accountProjectionSnapshot.status = "ready";
        accountProjectionSnapshot.accountProjectionReady = true;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-projection-incoming-1",
                        eventId: "persisted-projection-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 100_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-projection-outgoing-1",
                        eventId: "persisted-projection-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 101_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-shadow-outgoing-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self only",
                timestampMs: 101_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {
                [conversationId]: [{
                    messageId: "projection-shadow-incoming-1",
                    conversationId,
                    peerPublicKeyHex,
                    direction: "incoming",
                    eventCreatedAtUnixSeconds: 100,
                    plaintextPreview: "projection peer message",
                    observedAtUnixMs: 100_000,
                }],
            },
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 100,
            updatedAtUnixMs: 100_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "indexed-shadow-outgoing-1",
                content: "indexed self only",
            }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-projection-incoming-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                projectionEvidenceIncomingCount: 1,
                projectionBootstrapImportApplied: true,
                projectionCanonicalEvidencePending: false,
                indexedThinnessEvidenceForPersistedIncomingRepair: true,
                projectionReadAuthorityReason: "shadow_mode",
            }),
        }));
        unmount();
    });

    it("keeps indexed history authoritative in shadow mode when canonical bootstrap import already applied", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "ready";
        accountProjectionSnapshot.status = "ready";
        accountProjectionSnapshot.accountProjectionReady = true;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-bootstrap-incoming-1",
                        eventId: "persisted-bootstrap-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 110_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-bootstrap-outgoing-1",
                        eventId: "persisted-bootstrap-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 111_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-bootstrap-outgoing-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self only",
                timestampMs: 111_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {},
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: true,
            },
            lastSequence: 111,
            updatedAtUnixMs: 111_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "indexed-bootstrap-outgoing-1",
                content: "indexed self only",
            }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-bootstrap-incoming-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                projectionEvidenceIncomingCount: 0,
                projectionBootstrapImportApplied: true,
                projectionCanonicalEvidencePending: false,
                indexedThinnessEvidenceForPersistedIncomingRepair: true,
                projectionReadAuthorityReason: "shadow_mode",
            }),
        }));
        unmount();
    });

    it("uses persisted restored history while canonical evidence is still pending and indexed history is thinner", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "bootstrapping";
        accountProjectionSnapshot.status = "pending";
        accountProjectionSnapshot.accountProjectionReady = false;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-pending-incoming-1",
                        eventId: "persisted-pending-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 120_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-pending-outgoing-1",
                        eventId: "persisted-pending-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 121_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-pending-outgoing-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self only",
                timestampMs: 121_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {},
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: false,
            },
            lastSequence: 121,
            updatedAtUnixMs: 121_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "persisted-pending-incoming-1",
                content: "persisted peer message",
            }),
            expect.objectContaining({
                id: "persisted-pending-outgoing-1",
                content: "persisted self message",
            }),
        ]);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "persisted",
                selectedAuthorityReason: "persisted_recovery_indexed_missing_incoming",
                projectionBootstrapImportApplied: false,
                projectionCanonicalEvidencePending: true,
                projectionRestorePhaseActive: true,
                persistedCompatibilityRestorePhaseIncomingRepairCandidate: true,
                persistedCompatibilityRestorePhaseIncomingRepairReasonCode: "persisted_compatibility_restore_phase_missing_incoming",
            }),
        }));
        unmount();
    });

    it("uses persisted restored history while canonical evidence is still pending and indexed history is missing outgoing coverage", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "bootstrapping";
        accountProjectionSnapshot.status = "pending";
        accountProjectionSnapshot.accountProjectionReady = false;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-outgoing-gap-incoming-1",
                        eventId: "persisted-outgoing-gap-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 140_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-outgoing-gap-outgoing-1",
                        eventId: "persisted-outgoing-gap-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 141_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-outgoing-gap-incoming-1",
                conversationId,
                senderPubkey: peerPublicKeyHex,
                recipientPubkey: myPublicKeyHex,
                content: "indexed peer only",
                timestampMs: 140_000,
                isOutgoing: false,
                status: "delivered",
            },
        ] as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {},
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: false,
            },
            lastSequence: 141,
            updatedAtUnixMs: 141_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "persisted-outgoing-gap-incoming-1",
                content: "persisted peer message",
            }),
            expect.objectContaining({
                id: "persisted-outgoing-gap-outgoing-1",
                content: "persisted self message",
            }),
        ]);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "persisted",
                selectedAuthorityReason: "persisted_recovery_indexed_missing_outgoing",
                projectionBootstrapImportApplied: false,
                projectionCanonicalEvidencePending: true,
                projectionRestorePhaseActive: true,
            }),
        }));
        unmount();
    });

    it("keeps indexed history authoritative when canonical evidence is pending but restore phase is not active", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";
        accountProjectionSnapshot.phase = "idle";
        accountProjectionSnapshot.status = "pending";
        accountProjectionSnapshot.accountProjectionReady = false;

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-idle-incoming-1",
                        eventId: "persisted-idle-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 130_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-idle-outgoing-1",
                        eventId: "persisted-idle-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 131_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-idle-outgoing-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self only",
                timestampMs: 131_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);
        accountProjectionSnapshot.projection = {
            profileId: "default",
            accountPublicKeyHex: myPublicKeyHex,
            contactsByPeer: {},
            conversationsById: {},
            messagesByConversationId: {},
            sync: {
                checkpointsByTimelineKey: {},
                bootstrapImportApplied: false,
            },
            lastSequence: 131,
            updatedAtUnixMs: 131_000,
        };

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "indexed-idle-outgoing-1",
                content: "indexed self only",
            }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-idle-incoming-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                projectionBootstrapImportApplied: false,
                projectionCanonicalEvidencePending: true,
                projectionRestorePhaseActive: false,
                indexedThinnessEvidenceForPersistedIncomingRepair: true,
            }),
        }));
        unmount();
    });

    it("keeps indexed history authoritative in shadow mode when persisted would only repair outgoing coverage", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-shadow-incoming-1",
                        eventId: "persisted-shadow-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "peer message",
                        timestampMs: 80_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-shadow-outgoing-1",
                        eventId: "persisted-shadow-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "local self-authored message",
                        timestampMs: 81_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-incoming-only-1",
                conversationId,
                senderPubkey: peerPublicKeyHex,
                recipientPubkey: myPublicKeyHex,
                content: "indexed peer message",
                timestampMs: 80_000,
                isOutgoing: false,
                status: "delivered",
            },
        ] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({
                id: "indexed-incoming-only-1",
                content: "indexed peer message",
            }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-shadow-outgoing-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                indexedMessageCount: 1,
                indexedOutgoingCount: 0,
                indexedIncomingCount: 1,
                persistedFallbackMessageCount: 2,
                persistedFallbackOutgoingCount: 1,
                persistedFallbackIncomingCount: 1,
                projectionReadAuthorityReason: "shadow_mode",
            }),
        }));
        unmount();
    });

    it("keeps indexed history authoritative in shadow mode when outgoing-only indexed history is not thin enough for persisted incoming repair", async () => {
        const myPublicKeyHex = "a".repeat(64);
        const peerPublicKeyHex = "b".repeat(64);
        const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");
        projectionReadAuthorityState.useProjectionReads = false;
        projectionReadAuthorityState.reason = "shadow_mode";
        projectionReadAuthorityState.policyPhase = "shadow";

        chatStateStoreMocks.load.mockReturnValue({
            version: 2,
            createdConnections: [],
            createdGroups: [],
            unreadByConversationId: {},
            connectionOverridesByConnectionId: {},
            messagesByConversationId: {
                [conversationId]: [
                    {
                        id: "persisted-thick-incoming-1",
                        eventId: "persisted-thick-incoming-evt-1",
                        pubkey: peerPublicKeyHex,
                        content: "persisted peer message",
                        timestampMs: 90_000,
                        isOutgoing: false,
                        status: "delivered",
                    },
                    {
                        id: "persisted-thick-outgoing-1",
                        eventId: "persisted-thick-outgoing-evt-1",
                        pubkey: myPublicKeyHex,
                        content: "persisted self message",
                        timestampMs: 91_000,
                        isOutgoing: true,
                        status: "delivered",
                    },
                ],
            },
            groupMessages: {},
            connectionRequests: [],
            pinnedChatIds: [],
            hiddenChatIds: [],
        } as any);
        vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([
            {
                id: "indexed-outgoing-thick-1",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self 1",
                timestampMs: 90_000,
                isOutgoing: true,
                status: "delivered",
            },
            {
                id: "indexed-outgoing-thick-2",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self 2",
                timestampMs: 91_000,
                isOutgoing: true,
                status: "delivered",
            },
            {
                id: "indexed-outgoing-thick-3",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self 3",
                timestampMs: 92_000,
                isOutgoing: true,
                status: "delivered",
            },
            {
                id: "indexed-outgoing-thick-4",
                conversationId,
                senderPubkey: myPublicKeyHex,
                recipientPubkey: peerPublicKeyHex,
                content: "indexed self 4",
                timestampMs: 93_000,
                isOutgoing: true,
                status: "delivered",
            },
        ] as any);

        const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.messages).toEqual([
            expect.objectContaining({ id: "indexed-outgoing-thick-1" }),
            expect.objectContaining({ id: "indexed-outgoing-thick-2" }),
            expect.objectContaining({ id: "indexed-outgoing-thick-3" }),
            expect.objectContaining({ id: "indexed-outgoing-thick-4" }),
        ]);
        expect(result.current.messages.some((message) => message.id === "persisted-thick-incoming-1")).toBe(false);
        expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
            name: "messaging.conversation_history_authority_selected",
            context: expect.objectContaining({
                selectedAuthority: "indexed",
                selectedAuthorityReason: "indexed_primary",
                indexedMessageCount: 4,
                indexedThinnessEvidenceForPersistedIncomingRepair: false,
                persistedIncomingRepairIndexedMessageMax: 3,
                projectionReadAuthorityReason: "shadow_mode",
            }),
        }));
        unmount();
    });
});
