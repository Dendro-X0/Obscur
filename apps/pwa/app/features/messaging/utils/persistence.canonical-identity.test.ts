import { beforeEach, describe, expect, it } from "vitest";
import { loadPersistedChatState, savePersistedChatState } from "./persistence";

const PK = "pk_test_group_canonical_identity";

const createBaseState = () => ({
  version: 2,
  createdConnections: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  pinnedChatIds: [],
  hiddenChatIds: []
});

describe("persistence canonical identity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps hashed canonical identity when duplicate group records conflict by timestamp", () => {
    const hashedCommunityId = "v2_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const hashedId = `community:${hashedCommunityId}`;
    const fallbackId = "community:zeta:wss://relay.zeta";

    savePersistedChatState({
      ...createBaseState(),
      createdGroups: [
        {
          id: hashedId,
          communityId: hashedCommunityId,
          genesisEventId: "genesis-zeta",
          creatorPubkey: "creator-zeta",
          groupId: "zeta",
          relayUrl: "wss://relay.zeta",
          displayName: "Zeta",
          memberPubkeys: ["member_hashed"],
          lastMessage: "hashed",
          unreadCount: 0,
          lastMessageTimeMs: 10
        },
        {
          id: fallbackId,
          communityId: "zeta:wss://relay.zeta",
          groupId: "zeta",
          relayUrl: "wss://relay.zeta",
          displayName: "Zeta Newer",
          memberPubkeys: ["member_fallback"],
          lastMessage: "fallback",
          unreadCount: 0,
          lastMessageTimeMs: 999
        }
      ],
      unreadByConversationId: {
        [fallbackId]: 9,
        [hashedId]: 1
      },
      messagesByConversationId: {
        [fallbackId]: [{
          id: "m-zeta-fallback",
          content: "from fallback",
          timestampMs: 2,
          isOutgoing: false,
          status: "delivered"
        }],
        [hashedId]: [{
          id: "m-zeta-hashed",
          content: "from hashed",
          timestampMs: 1,
          isOutgoing: true,
          status: "delivered"
        }]
      }
    } as any, PK);

    const parsed = loadPersistedChatState(PK);
    expect(parsed?.createdGroups).toHaveLength(1);
    expect(parsed?.createdGroups[0]?.id).toBe(hashedId);
    expect(parsed?.createdGroups[0]?.communityId).toBe(hashedCommunityId);
    expect(parsed?.createdGroups[0]?.memberPubkeys).toEqual(["member_hashed", "member_fallback"]);
    expect(parsed?.unreadByConversationId[hashedId]).toBe(9);
    expect(Object.keys(parsed?.unreadByConversationId ?? {})).toEqual([hashedId]);
    expect(parsed?.messagesByConversationId[hashedId]).toHaveLength(2);
  });
});
