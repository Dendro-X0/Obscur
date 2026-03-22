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
        useProjectionReads: true,
        reason: "read_cutover_enabled",
        policy: {
            phase: "read_cutover",
            rollbackEnabled: true,
            updatedAtUnixMs: Date.now(),
        },
        criticalDriftCount: 0,
    }),
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
        clearMessageDeleteTombstones();
        accountProjectionSnapshot.projection = null;

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

    it("keeps hasEarlier enabled when indexed history exists and projection only supplements results", async () => {
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
        await waitFor(() => expect(result.current.messages.length).toBeGreaterThanOrEqual(200));
        expect(result.current.hasEarlier).toBe(true);
        unmount();
    });

    it("keeps the live conversation window capped at 200 when projection supplements include large history", async () => {
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
        expect(result.current.hasEarlier).toBe(true);
        unmount();
    });
});
