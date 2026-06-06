import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileRuntimeScope } from "../../profiles/services/profile-runtime-scope";
import { useSealedCommunity } from "./use-sealed-community";
import { resetMembershipCrdtPersistenceForTests } from "./use-community-membership-crdt";
import { roomKeyStore } from "../../crypto/room-key-store";

vi.mock("../services/community-workspace-r1-policy", () => ({
  shouldUseCoordinationMembershipAuthority: (mode: string | null | undefined) => mode === "managed_workspace",
}));

vi.mock("../services/community-membership-sync-mode", () => ({
  isCoordinationConfigured: () => true,
  readMembershipSyncMode: () => "coordination_preferred",
  getCoordinationBaseUrl: () => "http://127.0.0.1:8787",
}));

vi.mock("../../crypto/crypto-service", () => ({
  cryptoService: {
    decryptGroupMessage: vi.fn(),
    encryptGroupMessage: vi.fn(),
    signEvent: vi.fn(async (event: Record<string, unknown>) => ({
      ...event,
      id: `signed-${Math.random().toString(36).slice(2, 10)}`,
      sig: "sig",
    })),
    generateRoomKey: vi.fn(async () => "new-room-key"),
  },
}));

vi.mock("../../crypto/room-key-store", () => ({
  roomKeyStore: {
    getRoomKeyRecord: vi.fn(async () => ({ roomKeyHex: "room-key", previousKeys: [] })),
    getRoomKey: vi.fn(async () => "room-key"),
    rotateRoomKey: vi.fn(async () => undefined),
    deleteRoomKey: vi.fn(async () => undefined),
  },
}));

describe("useSealedCommunity Path B roster subtraction", () => {
  const scopedRelay = "wss://relay.team.internal";
  const groupId = "group-workspace";
  const actor = "aa".repeat(32) as PublicKeyHex;
  const peer = "bb".repeat(32) as PublicKeyHex;
  let onEventHandler: ((event: NostrEvent, url: string) => Promise<void>) | null = null;

  const createMembersEvent = (members: ReadonlyArray<PublicKeyHex>): NostrEvent => ({
    id: `members-${members.join("-")}`,
    pubkey: actor,
    kind: 39002,
    created_at: 700,
    sig: "sig",
    content: "",
    tags: [["h", groupId], ...members.map((pubkey) => ["p", pubkey])],
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    onEventHandler = null;
    const { createProfileMessageBus } = await import("@dweb/core/profile-message-bus");
    const bus = createProfileMessageBus({ profileId: "default" });
    setProfileRuntimeScope({ profileId: "default", bus });
    await resetMembershipCrdtPersistenceForTests();
    vi.mocked(roomKeyStore.getRoomKeyRecord).mockResolvedValue({
      groupId,
      roomKeyHex: "room-key",
      previousKeys: [],
      createdAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores relay roster_seed for managed_workspace (coordination owns roster)", async () => {
    const pool = {
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => vi.fn()),
      subscribe: vi.fn((_filters, onEvent) => {
        onEventHandler = onEvent;
        return "sub-id";
      }),
      unsubscribe: vi.fn(),
      publishToAll: vi.fn(async () => ({ success: true, successCount: 1, totalRelays: 1, results: [] })),
    };

    const { result } = renderHook(() => useSealedCommunity({
      pool: pool as never,
      relayUrl: scopedRelay,
      groupId,
      communityMode: "managed_workspace",
      myPublicKeyHex: actor,
      myPrivateKeyHex: "private-key" as never,
      enabled: true,
      initialMembers: [actor],
    }));

    await act(async () => {
      await onEventHandler?.(createMembersEvent([actor, peer]), scopedRelay);
    });

    expect(result.current.members).toEqual([actor]);
  });
});
