import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useSealedCommunity } from "./use-sealed-community";
import { cryptoService } from "../../crypto/crypto-service";
import { roomKeyStore } from "../../crypto/room-key-store";

vi.mock("../../crypto/crypto-service", () => ({
    cryptoService: {
        decryptGroupMessage: vi.fn(),
        encryptGroupMessage: vi.fn(async (payload: string) => ({
            ciphertext: `encrypted:${payload}`,
            nonce: "nonce"
        })),
        signEvent: vi.fn(async (event: Record<string, unknown>) => ({
            ...event,
            id: `signed-${Math.random().toString(36).slice(2, 10)}`,
            sig: "sig"
        })),
        generateRoomKey: vi.fn(async () => "new-room-key")
    }
}));

vi.mock("../../crypto/room-key-store", () => ({
    roomKeyStore: {
        getRoomKeyRecord: vi.fn(async () => ({ roomKeyHex: "room-key", previousKeys: [] })),
        getRoomKey: vi.fn(async () => "room-key"),
        rotateRoomKey: vi.fn(async () => undefined),
        deleteRoomKey: vi.fn(async () => undefined),
    }
}));

describe("use-sealed-community integration", () => {
    let onEventHandler: ((event: NostrEvent, url: string) => Promise<void>) | null;
    const onEventHandlers: Array<(event: NostrEvent, url: string) => Promise<void>> = [];
    const scopedRelay = "wss://relay.example";
    const groupId = "group-alpha";
    const actor = "actor-pubkey" as PublicKeyHex;
    const peer = "peer-pubkey" as PublicKeyHex;
    const another = "another-pubkey" as PublicKeyHex;

    const createEvent = (params: Readonly<{ id: string; createdAt: number; pubkey?: string; tags?: string[][]; content?: string }>): NostrEvent => ({
        id: params.id,
        pubkey: params.pubkey ?? actor,
        kind: 10105,
        created_at: params.createdAt,
        sig: "sig",
        content: params.content ?? "{}",
        tags: params.tags ?? [["h", groupId]]
    });
    const createDeleteEvent = (params: Readonly<{ id: string; createdAt: number; deleteIds: string[] }>): NostrEvent => ({
        id: params.id,
        pubkey: actor,
        kind: 5,
        created_at: params.createdAt,
        sig: "sig",
        content: "",
        tags: [
            ["h", groupId],
            ...params.deleteIds.map((deleteId) => ["e", deleteId])
        ]
    });
    const createMembersEvent = (params: Readonly<{ id: string; createdAt: number; members: ReadonlyArray<PublicKeyHex> }>): NostrEvent => ({
        id: params.id,
        pubkey: actor,
        kind: 39002,
        created_at: params.createdAt,
        sig: "sig",
        content: "",
        tags: [
            ["h", groupId],
            ...params.members.map((pubkey) => ["p", pubkey])
        ]
    });

    const createPool = () => ({
        sendToOpen: vi.fn(),
        subscribeToMessages: vi.fn(() => vi.fn()),
        subscribe: vi.fn((_filters, onEvent) => {
            onEventHandler = onEvent;
            onEventHandlers.push(onEvent);
            return "sub-id";
        }),
        unsubscribe: vi.fn(),
        publishToAll: vi.fn(async () => ({
            success: true,
            successCount: 1,
            totalRelays: 1,
            results: [{ success: true, relayUrl: scopedRelay }]
        }))
    });

    beforeEach(() => {
        vi.clearAllMocks();
        onEventHandler = null;
        onEventHandlers.length = 0;
        vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue({
            groupId: "group-alpha",
            roomKeyHex: "room-key",
            previousKeys: [],
            createdAt: 0
        });
        vi.mocked(roomKeyStore.getRoomKey).mockResolvedValue("room-key");
        vi.mocked(roomKeyStore.rotateRoomKey).mockResolvedValue(undefined);
        vi.mocked(roomKeyStore.deleteRoomKey).mockResolvedValue(undefined);
    });

    it("emits group-remove once when disband is replayed repeatedly", async () => {
        const dispatchSpy = vi.spyOn(window, "dispatchEvent");
        const pool = createPool();

        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({ type: "disband", pubkey: actor, created_at: 100 }))
            .mockResolvedValueOnce(JSON.stringify({ type: "disband", pubkey: actor, created_at: 110 }));

        renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "d1", createdAt: 100 }), scopedRelay);
            await onEventHandler?.(createEvent({ id: "d2", createdAt: 110 }), `${scopedRelay}/`);
        });

        await waitFor(() => {
            const removeCalls = dispatchSpy.mock.calls
                .map(([evt]) => evt)
                .filter((evt) => evt instanceof CustomEvent && evt.type === "obscur:group-remove") as CustomEvent<string>[];
            expect(removeCalls).toHaveLength(1);
            expect(removeCalls[0]?.detail).toBe(`community:${groupId}:${scopedRelay}`);
        });
    });

    it("publishes disband when the last known member leaves", async () => {
        const pool = createPool();
        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        await act(async () => {
            await result.current.leaveGroup();
        });

        const publishCalls = vi.mocked(pool.publishToAll).mock.calls as unknown as Array<[string]>;
        const publishedEvents = publishCalls
            .map(([payload]) => JSON.parse(payload)[1] as Record<string, unknown>);

        expect(publishedEvents.some((event) => event.kind === 9022)).toBe(true);
        expect(publishedEvents.some((event) => (
            event.kind === 10105
            && Array.isArray(event.tags)
            && (event.tags as ReadonlyArray<ReadonlyArray<string>>).some((tag) => tag[0] === "t" && tag[1] === "leave")
        ))).toBe(true);
        expect(publishedEvents.some((event) => (
            event.kind === 10105
            && Array.isArray(event.tags)
            && (event.tags as ReadonlyArray<ReadonlyArray<string>>).some((tag) => tag[0] === "t" && tag[1] === "disband")
        ))).toBe(true);
        expect(roomKeyStore.deleteRoomKey).toHaveBeenCalledWith(groupId);
    });

    it("does not implicitly disband on leave-only replay", async () => {
        const dispatchSpy = vi.spyOn(window, "dispatchEvent");
        const pool = createPool();

        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({ type: "leave", pubkey: actor, created_at: 200 }));

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "leave-1", createdAt: 200 }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.leftMembers).toContain(actor);
        });

        const removeCalls = dispatchSpy.mock.calls
            .map(([evt]) => evt)
            .filter((evt) => evt instanceof CustomEvent && evt.type === "obscur:group-remove");
        expect(removeCalls).toHaveLength(0);
        expect(result.current.state.disbandedAt).toBeUndefined();
    });

    it("ignores disband replay from non-scope relay or wrong community tag", async () => {
        const dispatchSpy = vi.spyOn(window, "dispatchEvent");
        const pool = createPool();

        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({ type: "disband", pubkey: actor, created_at: 300 }))
            .mockResolvedValueOnce(JSON.stringify({ type: "disband", pubkey: actor, created_at: 301 }));

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "wrong-relay", createdAt: 300 }), "wss://not-scoped.example");
            await onEventHandler?.(createEvent({ id: "wrong-tag", createdAt: 301, tags: [["h", "other-group"]] }), scopedRelay);
        });

        expect(result.current.state.disbandedAt).toBeUndefined();
        const removeCalls = dispatchSpy.mock.calls
            .map(([evt]) => evt)
            .filter((evt) => evt instanceof CustomEvent && evt.type === "obscur:group-remove");
        expect(removeCalls).toHaveLength(0);
    });

    it("converges to the same membership state across devices with reordered replay", async () => {
        const poolA = createPool();
        const poolB = createPool();

        vi.mocked(cryptoService.decryptGroupMessage).mockImplementation(async (encrypted) => {
            const parsed = (typeof encrypted === "string"
                ? JSON.parse(encrypted)
                : encrypted) as { payloadId?: string };
            const payloadId = parsed.payloadId;
            switch (payloadId) {
                case "join-early":
                    return JSON.stringify({ type: "join", pubkey: actor, created_at: 10 });
                case "leave-late":
                    return JSON.stringify({ type: "leave", pubkey: actor, created_at: 20 });
                case "join-peer":
                    return JSON.stringify({ type: "join", pubkey: peer, created_at: 15 });
                default:
                    return JSON.stringify({ type: "noop", pubkey: actor, created_at: 1, content: "" });
            }
        });

        const hookA = renderHook(() => useSealedCommunity({
            pool: poolA as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        const hookB = renderHook(() => useSealedCommunity({
            pool: poolB as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandlers).toHaveLength(2);
        const [handlerA, handlerB] = onEventHandlers;

        const joinEarly = createEvent({ id: "e1", createdAt: 10, content: JSON.stringify({ payloadId: "join-early" }) });
        const leaveLate = createEvent({ id: "e2", createdAt: 20, content: JSON.stringify({ payloadId: "leave-late" }) });
        const joinPeer = createEvent({ id: "e3", createdAt: 15, pubkey: peer, content: JSON.stringify({ payloadId: "join-peer" }) });

        await act(async () => {
            await handlerA?.(joinEarly, scopedRelay);
            await handlerA?.(joinPeer, scopedRelay);
            await handlerA?.(leaveLate, scopedRelay);
        });

        await act(async () => {
            await handlerB?.(leaveLate, scopedRelay);
            await handlerB?.(joinEarly, scopedRelay);
            await handlerB?.(joinPeer, scopedRelay);
        });

        await waitFor(() => {
            const membersA = [...hookA.result.current.members].sort();
            const membersB = [...hookB.result.current.members].sort();
            expect(membersA).toEqual(membersB);
            expect(membersA).toEqual([peer].sort());
            expect(hookA.result.current.state.membership.status).toBe(hookB.result.current.state.membership.status);
            expect(hookA.result.current.state.membership.status).toBe("not_member");
            expect(hookA.result.current.state.leftMembers).toEqual(hookB.result.current.state.leftMembers);
            expect(hookA.result.current.state.leftMembers).toContain(actor);
            expect(hookA.result.current.state.disbandedAt).toEqual(hookB.result.current.state.disbandedAt);
            expect(hookA.result.current.state.disbandedAt).toBeUndefined();
        });
    });

    it("ignores non-disband events after disband terminal state", async () => {
        const pool = createPool();
        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({ type: "disband", pubkey: actor, created_at: 400 }))
            .mockResolvedValueOnce(JSON.stringify({ type: "join", pubkey: peer, created_at: 500 }));

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "disband-1", createdAt: 400 }), scopedRelay);
            await onEventHandler?.(createEvent({ id: "join-after-disband", createdAt: 500, pubkey: peer }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.disbandedAt).toBe(400);
            expect(result.current.members).toEqual([]);
        });
    });

    it("hydrates metadata and membership from community.created event", async () => {
        const pool = createPool();
        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({
                type: "community.created",
                pubkey: actor,
                created_at: 123,
                metadata: {
                    id: groupId,
                    name: "Alpha",
                    about: "Sealed community",
                    picture: "https://example.com/a.png",
                    access: "invite-only"
                }
            }));

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: []
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "created-1", createdAt: 123, pubkey: actor }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.metadata?.name).toBe("Alpha");
            expect(result.current.state.metadata?.about).toBe("Sealed community");
            expect(result.current.state.metadata?.access).toBe("invite-only");
            expect(result.current.members).toContain(actor);
        });
    });

    it("keeps deleted group message removed when stale replay arrives later", async () => {
        const pool = createPool();
        vi.mocked(cryptoService.decryptGroupMessage)
            .mockResolvedValueOnce(JSON.stringify({ type: "message", pubkey: actor, created_at: 600, content: "hello" }))
            .mockResolvedValueOnce(JSON.stringify({ type: "message", pubkey: actor, created_at: 600, content: "hello replay" }));

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createEvent({ id: "msg-1", createdAt: 600, pubkey: actor }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.messages.some((message) => message.id === "msg-1")).toBe(true);
        });

        await act(async () => {
            await onEventHandler?.(createDeleteEvent({ id: "delete-1", createdAt: 601, deleteIds: ["msg-1"] }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.messages.some((message) => message.id === "msg-1")).toBe(false);
        });

        await act(async () => {
            await onEventHandler?.(createEvent({ id: "msg-1", createdAt: 602, pubkey: actor }), scopedRelay);
        });

        await waitFor(() => {
            expect(result.current.state.messages.some((message) => message.id === "msg-1")).toBe(false);
        });
    });

    it("preserves local creator membership when roster replay omits self but local key evidence exists", async () => {
        const pool = createPool();

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: []
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createMembersEvent({ id: "members-omits-self", createdAt: 700, members: [peer] }), scopedRelay);
        });

        await waitFor(() => {
            expect([...result.current.members].sort()).toEqual([actor, peer].sort());
        });
    });

    it("merges roster seeds even when members are already populated", async () => {
        const pool = createPool();

        const { result } = renderHook(() => useSealedCommunity({
            pool: pool as any,
            relayUrl: scopedRelay,
            groupId,
            myPublicKeyHex: actor,
            myPrivateKeyHex: "private-key" as any,
            enabled: true,
            initialMembers: [actor]
        }));

        expect(onEventHandler).toBeTruthy();
        await act(async () => {
            await onEventHandler?.(createMembersEvent({ id: "members-additions", createdAt: 701, members: [peer, another] }), scopedRelay);
        });

        await waitFor(() => {
            expect([...result.current.members].sort()).toEqual([actor, another, peer].sort());
        });
    });
});
