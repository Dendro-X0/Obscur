import { describe, expect, it } from "vitest";
import type { Conversation, DmConversation, GroupConversation } from "../types";
import {
  applySelectedConversationUnreadIsolation,
  resolveSelectedConversationUnreadKeys,
} from "./unread-isolation";

const DM: DmConversation = {
  kind: "dm",
  id: [
    "a".repeat(64),
    "b".repeat(64),
  ].sort().join(":"),
  pubkey: "b".repeat(64) as DmConversation["pubkey"],
  displayName: "Peer",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
};

const GROUP: GroupConversation = {
  kind: "group",
  id: "community:v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  communityId: "v2_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  groupId: "alpha",
  relayUrl: "wss://relay.alpha",
  displayName: "Alpha",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 3,
  lastMessageTime: new Date(2_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
};

describe("unread-isolation", () => {
  it("anchors selected dm target with explicit zero when unread key is missing", () => {
    const next = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {},
      selectedConversation: DM,
    });
    expect(next).toEqual({
      [DM.id]: 0,
    });
  });

  it("clears positive unread for selected dm target", () => {
    const next = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [DM.id]: 4,
      },
      selectedConversation: DM,
    });
    expect(next).toEqual({
      [DM.id]: 0,
    });
  });

  it("clears selected group unread across canonical and legacy alias keys", () => {
    const next = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [GROUP.id]: 5,
        "community:alpha:wss://relay.alpha": 2,
        "group:alpha:wss://relay.alpha": 1,
        "alpha@relay.alpha": 3,
      },
      selectedConversation: GROUP,
    });
    expect(next).toEqual({
      [GROUP.id]: 0,
      "community:alpha:wss://relay.alpha": 0,
      "group:alpha:wss://relay.alpha": 0,
      "alpha@relay.alpha": 0,
    });
  });

  it("returns null when selected target is already isolated", () => {
    const next = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [GROUP.id]: 0,
      },
      selectedConversation: GROUP,
    });
    expect(next).toBeNull();
  });

  it("derives deterministic key set for selected group target", () => {
    const keys = resolveSelectedConversationUnreadKeys(GROUP);
    expect(keys).toEqual(expect.arrayContaining([
      GROUP.id,
      `community:${GROUP.communityId}`,
      `community:${GROUP.groupId}:${GROUP.relayUrl}`,
      `group:${GROUP.groupId}:${GROUP.relayUrl}`,
      `${GROUP.groupId}@relay.alpha`,
    ]));
  });

  it("returns null when there is no selected conversation", () => {
    const next = applySelectedConversationUnreadIsolation({
      currentUnreadByConversationId: {
        [DM.id]: 1,
      },
      selectedConversation: null as Conversation | null,
    });
    expect(next).toBeNull();
  });
});
