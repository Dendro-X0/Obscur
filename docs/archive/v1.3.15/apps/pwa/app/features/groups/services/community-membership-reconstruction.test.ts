import { describe, expect, it } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  reconstructCommunityMembershipFromChatState,
  reconstructRoomKeysFromChatState,
  supplementMembershipLedgerEntries,
} from "./community-membership-reconstruction";

const createEmptyChatState = (): PersistedChatState => ({
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
});

describe("community-membership-reconstruction", () => {
  it("reconstructs joined entries from persisted created groups", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      createdGroups: [{
        id: "community:alpha:wss://relay.alpha",
        communityId: "alpha:wss://relay.alpha",
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        displayName: "Alpha",
        memberPubkeys: [],
        lastMessage: "",
        unreadCount: 0,
        lastMessageTimeMs: 1_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
    };

    const reconstructed = reconstructCommunityMembershipFromChatState(chatState);
    expect(reconstructed).toEqual([
      expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        communityId: "alpha:wss://relay.alpha",
        status: "joined",
        updatedAtUnixMs: 1_000,
        displayName: "Alpha",
      }),
    ]);
  });

  it("reconstructs joined entries from incoming accepted community invite responses in dm history", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-accepted",
          content: JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: "beta",
            relayUrl: "wss://relay.beta",
            communityId: "beta:wss://relay.beta",
          }),
          timestampMs: 2_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
    };

    const reconstructed = reconstructCommunityMembershipFromChatState(chatState);
    expect(reconstructed).toEqual([
      expect.objectContaining({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        status: "joined",
        updatedAtUnixMs: 2_000,
      }),
    ]);
  });

  it("does not reconstruct joined entries from sender-local accepted invite responses", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-accepted-local",
          content: JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: "beta",
            relayUrl: "wss://relay.beta",
            communityId: "beta:wss://relay.beta",
          }),
          timestampMs: 2_000,
          isOutgoing: true,
          status: "delivered",
        }],
      },
    };

    expect(reconstructCommunityMembershipFromChatState(chatState)).toEqual([]);
  });

  it("reconstructs joined entries from sender-local accepted response when matching room-key invite evidence exists", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-invite",
          content: JSON.stringify({
            type: "community-invite",
            groupId: "beta",
            roomKey: "rk-beta-1",
            relayUrl: "wss://relay.beta",
            communityId: "beta:wss://relay.beta",
            metadata: {
              name: "TestClub1",
              picture: "https://cdn.example.testclub/avatar.png",
            },
          }),
          timestampMs: 1_000,
          isOutgoing: false,
          status: "delivered",
        }, {
          id: "m-accepted-local",
          content: JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: "beta",
            relayUrl: "wss://relay.beta",
            communityId: "beta:wss://relay.beta",
          }),
          timestampMs: 2_000,
          isOutgoing: true,
          status: "delivered",
        }],
      },
    };

    expect(reconstructCommunityMembershipFromChatState(chatState)).toEqual([
      expect.objectContaining({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        communityId: "beta:wss://relay.beta",
        status: "joined",
        updatedAtUnixMs: 2_000,
        displayName: "TestClub1",
        avatar: "https://cdn.example.testclub/avatar.png",
      }),
    ]);
  });

  it("reconstructs joined entries from persisted group-message timelines", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      groupMessages: {
        "community:omega:wss://relay.omega": [{
          id: "g-1",
          pubkey: "peer",
          created_at: 8,
          content: "hello from omega",
        }],
      },
    };

    const reconstructed = reconstructCommunityMembershipFromChatState(chatState);
    expect(reconstructed).toEqual([
      expect.objectContaining({
        groupId: "omega",
        relayUrl: "wss://relay.omega",
        communityId: "omega:wss://relay.omega",
        status: "joined",
        updatedAtUnixMs: 8_000,
      }),
    ]);
  });

  it("supplements only missing keys and does not override explicit ledger entries", () => {
    const explicit: ReadonlyArray<CommunityMembershipLedgerEntry> = [{
      communityId: "alpha:wss://relay.alpha",
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      status: "left",
      updatedAtUnixMs: 2_000,
    }];
    const supplemental: ReadonlyArray<CommunityMembershipLedgerEntry> = [{
      communityId: "alpha:wss://relay.alpha",
      groupId: "alpha",
      relayUrl: "wss://relay.alpha",
      status: "joined",
      updatedAtUnixMs: 9_000,
    }, {
      communityId: "beta:wss://relay.beta",
      groupId: "beta",
      relayUrl: "wss://relay.beta",
      status: "joined",
      updatedAtUnixMs: 1_500,
    }];

    const merged = supplementMembershipLedgerEntries({
      explicitEntries: explicit,
      supplementalEntries: supplemental,
    });

    expect(merged).toEqual(expect.arrayContaining([
      expect.objectContaining({
        groupId: "alpha",
        relayUrl: "wss://relay.alpha",
        status: "left",
        updatedAtUnixMs: 2_000,
      }),
      expect.objectContaining({
        groupId: "beta",
        relayUrl: "wss://relay.beta",
        status: "joined",
      }),
    ]));
    expect(merged.find((entry) => entry.groupId === "alpha")?.status).toBe("left");
  });

  it("reconstructs room key snapshots from community invite messages", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-invite",
          content: JSON.stringify({
            type: "community-invite",
            groupId: "omega",
            roomKey: "rk-omega-1",
            relayUrl: "wss://relay.omega",
          }),
          timestampMs: 4_000,
          isOutgoing: false,
          status: "delivered",
        }],
      },
    };

    expect(reconstructRoomKeysFromChatState(chatState)).toEqual([
      expect.objectContaining({
        groupId: "omega",
        roomKeyHex: "rk-omega-1",
        createdAt: 4_000,
      }),
    ]);
  });

  it("keeps newest room key and preserves older keys as history", () => {
    const chatState: PersistedChatState = {
      ...createEmptyChatState(),
      messagesByConversationId: {
        "dm:peer": [{
          id: "m-invite-old",
          content: JSON.stringify({
            type: "community-invite",
            groupId: "omega",
            roomKey: "rk-omega-old",
            relayUrl: "wss://relay.omega",
          }),
          timestampMs: 4_000,
          isOutgoing: true,
          status: "delivered",
        }, {
          id: "m-invite-new",
          content: JSON.stringify({
            type: "community-invite",
            groupId: "omega",
            roomKey: "rk-omega-new",
            relayUrl: "wss://relay.omega",
          }),
          timestampMs: 5_000,
          isOutgoing: true,
          status: "delivered",
        }],
      },
    };

    expect(reconstructRoomKeysFromChatState(chatState)).toEqual([
      expect.objectContaining({
        groupId: "omega",
        roomKeyHex: "rk-omega-new",
        createdAt: 5_000,
        previousKeys: expect.arrayContaining(["rk-omega-old"]),
      }),
    ]);
  });
});
