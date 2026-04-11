import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { peerTrustInternals, usePeerTrust } from "./use-peer-trust";

const chatStateStoreMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
  chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({
    profileId: "default",
    accountPublicKeyHex: "f".repeat(64),
    projection: null,
    phase: "ready",
    status: "ready",
    accountProjectionReady: false,
    driftStatus: "clean",
    updatedAtUnixMs: 1,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-read-authority", () => ({
  resolveProjectionReadAuthority: () => ({
    useProjectionReads: false,
    reason: "projection_not_ready",
    policy: {
      phase: "shadow",
      rollbackEnabled: true,
      updatedAtUnixMs: 1,
    },
    criticalDriftCount: 0,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-selectors", () => ({
  selectProjectionAcceptedPeers: () => [],
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => "default",
  getScopedStorageKey: (key: string) => key,
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

vi.mock("@/app/features/account-sync/services/account-event-ingest-bridge", () => ({
  appendCanonicalContactEvent: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/account-sync/services/account-sync-migration-policy", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/account-sync/services/account-sync-migration-policy")>(
    "@/app/features/account-sync/services/account-sync-migration-policy"
  );
  return {
    ...actual,
    shouldWriteLegacyContactsDm: () => true,
  };
});

const createPersistedChatState = (overrides?: Partial<PersistedChatState>): PersistedChatState => ({
  version: 2,
  createdConnections: [],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
  ...overrides,
});

describe("use-peer-trust internals", () => {
  beforeEach(() => {
    chatStateStoreMocks.load.mockReset();
    localStorage.clear();
  });

  it("builds unique contact mutation suffixes across repeated actions for the same peer", () => {
    const peerPublicKeyHex = "e".repeat(64) as PublicKeyHex;
    const first = peerTrustInternals.createContactMutationIdempotencySuffix({
      action: "unaccept",
      peerPublicKeyHex,
      atUnixMs: 1000,
      nonce: 1,
    });
    const second = peerTrustInternals.createContactMutationIdempotencySuffix({
      action: "unaccept",
      peerPublicKeyHex,
      atUnixMs: 1000,
      nonce: 2,
    });

    expect(first).toBe(`unaccept:${peerPublicKeyHex}:1000:1`);
    expect(second).toBe(`unaccept:${peerPublicKeyHex}:1000:2`);
    expect(second).not.toBe(first);
  });

  it("hydrates accepted peers from accepted requests and existing DM connections", () => {
    const acceptedRequestPeer = "a".repeat(64).toUpperCase();
    const acceptedConnectionPeer = "b".repeat(64).toUpperCase();

    const persisted = createPersistedChatState({
      connectionRequests: [
        {
          id: acceptedRequestPeer,
          status: "accepted",
          isOutgoing: true,
          timestampMs: 1,
        },
        {
          id: "c".repeat(64),
          status: "pending",
          isOutgoing: true,
          timestampMs: 2,
        },
      ],
      createdConnections: [
        {
          id: "dm-1",
          displayName: "peer-b",
          pubkey: acceptedConnectionPeer,
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 0,
        },
        {
          id: "dm-2",
          displayName: "peer-duplicate",
          pubkey: acceptedRequestPeer,
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 0,
        },
      ],
    });

    const result = peerTrustInternals.extractAcceptedPeersFromPersistedChatState(persisted);
    expect(result).toEqual([
      acceptedRequestPeer.toLowerCase(),
      acceptedConnectionPeer.toLowerCase(),
    ]);
  });

  it("ignores non-accepted requests and invalid pubkeys", () => {
    const persisted = createPersistedChatState({
      connectionRequests: [
        {
          id: "invalid",
          status: "accepted",
          isOutgoing: false,
          timestampMs: 1,
        },
        {
          id: "d".repeat(64),
          status: "declined",
          isOutgoing: false,
          timestampMs: 2,
        },
      ],
      createdConnections: [
        {
          id: "dm-1",
          displayName: "invalid",
          pubkey: "xyz",
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 0,
        },
      ],
    });

    const result = peerTrustInternals.extractAcceptedPeersFromPersistedChatState(persisted);
    expect(result).toEqual([]);
  });

  it("returns empty for missing persisted chat state", () => {
    expect(peerTrustInternals.extractAcceptedPeersFromPersistedChatState(null)).toEqual([]);
    expect(peerTrustInternals.extractAcceptedPeersFromPersistedChatState(undefined)).toEqual([]);
  });

  it("rehydrates accepted peers when chat state is replaced after an initially empty load", async () => {
    const myPublicKeyHex = "f".repeat(64) as PublicKeyHex;
    const peerPublicKeyHex = "e".repeat(64) as PublicKeyHex;
    let restoreApplied = false;
    chatStateStoreMocks.load.mockImplementation(() => {
      if (!restoreApplied) {
        return null;
      }
      return createPersistedChatState({
        createdConnections: [{
          id: "dm-restore",
          displayName: "Peer",
          pubkey: peerPublicKeyHex,
          lastMessage: "restored",
          unreadCount: 0,
          lastMessageTimeMs: 1_000,
        }],
      });
    });

    const { result } = renderHook(() => usePeerTrust({ publicKeyHex: myPublicKeyHex }));
    await waitFor(() => expect(result.current.hasHydrated).toBe(true));
    expect(result.current.state.acceptedPeers).toEqual([]);

    restoreApplied = true;
    act(() => {
      window.dispatchEvent(new CustomEvent("obscur:chat-state-replaced", {
        detail: { publicKeyHex: myPublicKeyHex },
      }));
    });

    await waitFor(() => expect(result.current.state.acceptedPeers).toEqual([peerPublicKeyHex]));
  });
});
