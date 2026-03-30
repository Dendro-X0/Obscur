import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PersistedChatState } from "@/app/features/messaging/types";
import { peerTrustInternals } from "./use-peer-trust";

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
});
