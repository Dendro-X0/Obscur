import { describe, expect, it } from "vitest";
import type { DmConversation, GroupConversation } from "../types";
import {
  buildConversationHeadAtMsByIdFromPersisted,
  hasSeenConversationHead,
  mergeUnreadByConversationIdForRestore,
  resolveConversationUnreadCount,
  suppressUnreadByLastSeen,
} from "./unread-last-seen-suppression";

const GROUP: GroupConversation = {
  kind: "group",
  id: "community:alpha:wss://relay.alpha",
  communityId: "v2_alpha",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  displayName: "Alpha Group",
  memberPubkeys: [],
  lastMessage: "joined",
  unreadCount: 1,
  lastMessageTime: new Date(5_000),
  access: "invite-only",
  memberCount: 2,
  adminPubkeys: [],
};

const DM: DmConversation = {
  kind: "dm",
  id: "dm:peer",
  pubkey: "b".repeat(64) as DmConversation["pubkey"],
  displayName: "Peer",
  lastMessage: "hello",
  unreadCount: 4,
  lastMessageTime: new Date(6_000),
};

describe("unread-last-seen-suppression", () => {
  it("detects when the conversation head was seen", () => {
    expect(hasSeenConversationHead(5_001, 5_000)).toBe(true);
    expect(hasSeenConversationHead(4_999, 5_000)).toBe(false);
  });

  it("suppresses stale persisted unread after the user viewed the group", () => {
    const suppressed = suppressUnreadByLastSeen({
      unreadByConversationId: {
        [GROUP.id]: 1,
      },
      lastSeenByConversationId: {
        [GROUP.id]: 5_000,
        "group:alpha:wss://relay.alpha": 5_000,
      },
      conversations: [GROUP],
    });

    expect(suppressed[GROUP.id]).toBe(0);
  });

  it("resolves sidebar unread from lastSeen even when metadata unreadCount is stale", () => {
    const unread = resolveConversationUnreadCount({
      conversation: GROUP,
      unreadByConversationId: {},
      lastSeenByConversationId: {
        [GROUP.id]: 5_000,
      },
    });

    expect(unread).toBe(0);
  });

  it("keeps unread when the conversation head is newer than lastSeen", () => {
    const unread = resolveConversationUnreadCount({
      conversation: GROUP,
      unreadByConversationId: {
        [GROUP.id]: 2,
      },
      lastSeenByConversationId: {
        [GROUP.id]: 4_000,
      },
    });

    expect(unread).toBe(2);
  });

  it("builds conversation heads from persisted chat state", () => {
    const heads = buildConversationHeadAtMsByIdFromPersisted({
      version: 2,
      createdConnections: [],
      createdGroups: [{
        id: GROUP.id,
        groupId: GROUP.groupId,
        relayUrl: GROUP.relayUrl,
        displayName: GROUP.displayName,
        memberPubkeys: [],
        lastMessage: GROUP.lastMessage,
        unreadCount: 1,
        lastMessageTimeMs: 5_000,
        access: "invite-only",
        memberCount: 2,
        adminPubkeys: [],
      }],
      unreadByConversationId: {},
      connectionOverridesByConnectionId: {},
      messagesByConversationId: {},
      connectionRequests: [],
      pinnedChatIds: [],
      hiddenChatIds: [],
      groupMessages: {},
    });

    expect(heads[GROUP.id]).toBe(5_000);
  });

  it("prefers local unread over incoming restore values", () => {
    expect(mergeUnreadByConversationIdForRestore(
      { [GROUP.id]: 0, [DM.id]: 1 },
      { [GROUP.id]: 1, [DM.id]: 0 },
    )).toEqual({
      [GROUP.id]: 0,
      [DM.id]: 1,
    });
  });
});
