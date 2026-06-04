import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import { buildCommunityMembershipReadModelIndexGroupInputs } from "./community-membership-read-model-index-input";
import { saveCommunityTerminalMembershipCache } from "./community-terminal-membership-cache";

const OWNER = "a".repeat(64) as PublicKeyHex;
const PEER = "b".repeat(64) as PublicKeyHex;
const CONVERSATION_ID = "community:g1:wss://relay.test";
const GROUP_ID = "g1";
const RELAY_URL = "wss://relay.test";

const makeGroup = (memberPubkeys: ReadonlyArray<PublicKeyHex>): GroupConversation => ({
  kind: "group",
  id: CONVERSATION_ID,
  communityId: `${GROUP_ID}:${RELAY_URL}`,
  groupId: GROUP_ID,
  relayUrl: RELAY_URL,
  displayName: "Test Group",
  memberPubkeys,
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "invite-only",
  memberCount: memberPubkeys.length,
  adminPubkeys: [],
});

describe("MEM-002 — community membership read-model index inputs", () => {
  it("chat-style terminal overrides align with cached terminal evidence", () => {
    window.localStorage.clear();
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PEER],
      expelledMemberPubkeys: [],
    });

    const group = makeGroup([OWNER, PEER]);
    const rosterProjection = {
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: group.communityId,
      activeMemberPubkeys: [OWNER] as ReadonlyArray<PublicKeyHex>,
      memberCount: 1,
    };
    const directory = {
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      participantPubkeys: [OWNER, PEER] as ReadonlyArray<PublicKeyHex>,
      participantCount: 2,
    };

    const networkStyle = buildCommunityMembershipReadModelIndexGroupInputs({
      ownerPubkey: OWNER,
      groups: [group],
      communityKnownParticipantDirectoryByConversationId: {
        [CONVERSATION_ID]: directory,
      },
      communityRosterByConversationId: {
        [CONVERSATION_ID]: rosterProjection,
      },
    })[0]!;

    const chatStyle = buildCommunityMembershipReadModelIndexGroupInputs({
      ownerPubkey: OWNER,
      groups: [group],
      communityKnownParticipantDirectoryByConversationId: {
        [CONVERSATION_ID]: directory,
      },
      communityRosterByConversationId: {
        [CONVERSATION_ID]: rosterProjection,
      },
      terminalOverridesByConversationId: {
        [CONVERSATION_ID]: {
          leftMemberPubkeys: [PEER],
          expelledMemberPubkeys: [],
        },
      },
    })[0]!;

    expect(networkStyle.persistedGroupMemberPubkeys).toEqual(chatStyle.persistedGroupMemberPubkeys);
    expect(networkStyle.applyTerminalMembershipExclusions).toBe(true);
    expect(chatStyle.leftMemberPubkeys).toEqual([PEER]);
  });

  it("prefers roster projection over stale group.memberPubkeys", () => {
    const group = makeGroup([OWNER, PEER]);
    const inputs = buildCommunityMembershipReadModelIndexGroupInputs({
      ownerPubkey: OWNER,
      groups: [group],
      communityKnownParticipantDirectoryByConversationId: {},
      communityRosterByConversationId: {
        [CONVERSATION_ID]: {
          conversationId: CONVERSATION_ID,
          groupId: GROUP_ID,
          relayUrl: RELAY_URL,
          activeMemberPubkeys: [OWNER, PEER, "c".repeat(64) as PublicKeyHex],
          memberCount: 3,
        },
      },
    });

    expect(inputs[0]?.persistedGroupMemberPubkeys).toHaveLength(3);
    expect(inputs[0]?.persistedGroupMemberPubkeys).not.toEqual(group.memberPubkeys);
  });
});
