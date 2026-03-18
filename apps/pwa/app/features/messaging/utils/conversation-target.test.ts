import { describe, expect, it } from "vitest";
import type { DmConversation, GroupConversation } from "../types";
import { resolveConversationByToken, resolveGroupConversationByToken } from "./conversation-target";

const GROUP: GroupConversation = {
  kind: "group",
  id: "community:delta:wss://relay.delta",
  communityId: "delta:wss://relay.delta",
  groupId: "delta",
  relayUrl: "wss://relay.delta",
  displayName: "Delta",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
};

const DM: DmConversation = {
  kind: "dm",
  id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  pubkey: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  displayName: "Alice",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
};

describe("conversation-target", () => {
  it("resolves groups by canonical id and encoded canonical id", () => {
    expect(resolveGroupConversationByToken([GROUP], GROUP.id)?.id).toBe(GROUP.id);
    expect(resolveGroupConversationByToken([GROUP], encodeURIComponent(GROUP.id))?.id).toBe(GROUP.id);
  });

  it("resolves groups by groupId and communityId", () => {
    expect(resolveGroupConversationByToken([GROUP], GROUP.groupId)?.id).toBe(GROUP.id);
    expect(resolveGroupConversationByToken([GROUP], GROUP.communityId ?? "")?.id).toBe(GROUP.id);
  });

  it("does not fall back to DM when token is explicitly group-shaped but group is missing", () => {
    const resolved = resolveConversationByToken({
      token: "community:missing:wss://relay",
      groups: [],
      connections: [DM],
    });
    expect(resolved).toBeNull();
  });

  it("falls back to DM when token is not group-shaped and matches dm id", () => {
    const resolved = resolveConversationByToken({
      token: DM.id,
      groups: [GROUP],
      connections: [DM],
    });
    expect(resolved).toEqual(DM);
  });
});

