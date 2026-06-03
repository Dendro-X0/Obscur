import { describe, expect, it } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";
import type { CommunityMembershipLedgerEntry } from "./community-membership-ledger";
import {
  buildInviteMemberPubkeysByGroupKey,
  enrichCommunityMembershipLedgerMemberPubkeysFromInviteEvidence,
  enrichPersistedCreatedGroupsMemberPubkeysFromInviteEvidence,
} from "./community-invite-member-pubkeys";
import { toGroupConversationFromMembershipLedgerEntry } from "./community-membership-ledger";

const LOCAL = "b".repeat(64);
const PEER = "c".repeat(64);
const GROUP_ID = "invite-peer";
const RELAY_URL = "wss://relay.peer";
const COMMUNITY_ID = `${GROUP_ID}:${RELAY_URL}`;

const emptyChatState = (): PersistedChatState => ({
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

const inviteChatState = (): PersistedChatState => ({
  ...emptyChatState(),
  createdConnections: [{
    id: `${PEER}:${LOCAL}`,
    displayName: "Peer",
    pubkey: PEER,
    lastMessage: "accepted",
    unreadCount: 0,
    lastMessageTimeMs: 8_500,
  }],
  messagesByConversationId: {
    [`${PEER}:${LOCAL}`]: [{
      id: "invite-1",
      content: JSON.stringify({
        type: "community-invite",
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        communityId: COMMUNITY_ID,
        roomKey: "rk",
      }),
      timestampMs: 8_000,
      isOutgoing: false,
      status: "delivered",
      pubkey: PEER,
    }, {
      id: "invite-accept-1",
      content: JSON.stringify({
        type: "community-invite-response",
        status: "accepted",
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        communityId: COMMUNITY_ID,
      }),
      timestampMs: 8_200,
      isOutgoing: true,
      status: "delivered",
      pubkey: LOCAL,
    }],
  },
});

describe("community-invite-member-pubkeys (MEM-003)", () => {
  it("buildInviteMemberPubkeysByGroupKey maps accepted invite peers by group key", () => {
    const grouped = buildInviteMemberPubkeysByGroupKey({
      localPublicKeyHex: LOCAL,
      chatState: inviteChatState(),
    });

    expect(grouped[`${GROUP_ID}@@${RELAY_URL}`]).toEqual([PEER]);
  });

  it("enrichCommunityMembershipLedgerMemberPubkeysFromInviteEvidence adds invite peers to joined rows", () => {
    const entry: CommunityMembershipLedgerEntry = {
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 9_000,
      memberPubkeys: [LOCAL],
    };

    const enriched = enrichCommunityMembershipLedgerMemberPubkeysFromInviteEvidence({
      entries: [entry],
      chatState: inviteChatState(),
      localPublicKeyHex: LOCAL,
    });

    expect(enriched[0]?.memberPubkeys).toEqual(expect.arrayContaining([LOCAL, PEER]));
  });

  it("toGroupConversationFromMembershipLedgerEntry unions thin ledger rows with invite fallbacks", () => {
    const group = toGroupConversationFromMembershipLedgerEntry({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      communityId: COMMUNITY_ID,
      status: "joined",
      updatedAtUnixMs: 9_000,
      memberPubkeys: [LOCAL],
    }, {
      fallbackMemberPubkeys: [LOCAL, PEER],
    });

    expect(group.memberPubkeys).toEqual(expect.arrayContaining([LOCAL, PEER]));
    expect(group.memberCount).toBeGreaterThanOrEqual(2);
  });

  it("enrichPersistedCreatedGroupsMemberPubkeysFromInviteEvidence widens createdGroups rows", () => {
    const chatState: PersistedChatState = {
      ...inviteChatState(),
      createdGroups: [{
        id: `community:${COMMUNITY_ID}`,
        communityId: COMMUNITY_ID,
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        displayName: "Invite Peer",
        memberPubkeys: [LOCAL],
        lastMessage: "restored self only",
        unreadCount: 0,
        lastMessageTimeMs: 9_000,
        access: "invite-only",
        memberCount: 1,
        adminPubkeys: [],
      }],
    };

    const enriched = enrichPersistedCreatedGroupsMemberPubkeysFromInviteEvidence(chatState, LOCAL)!;
    expect(enriched.createdGroups[0]?.memberPubkeys).toEqual(expect.arrayContaining([LOCAL, PEER]));
    expect(enriched.createdGroups[0]?.memberCount).toBeGreaterThanOrEqual(2);
  });
});
