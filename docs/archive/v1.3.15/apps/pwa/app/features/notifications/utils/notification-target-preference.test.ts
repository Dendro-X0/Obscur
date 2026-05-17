import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  isConversationNotificationsEnabled,
  isMessageNotificationEnabledForIncomingEvent,
  setConversationNotificationsEnabled,
} from "./notification-target-preference";
import type { Conversation, DmConversation, Message } from "@/app/features/messaging/types";

const createDmConversation = (pubkey: string): DmConversation => ({
  kind: "dm",
  id: "my:peer",
  displayName: "Peer",
  pubkey: pubkey as PublicKeyHex,
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
});

const createGroupConversation = (): Conversation => ({
  kind: "group",
  id: "community:relay.example.com:group-a",
  groupId: "group-a",
  relayUrl: "wss://relay.example.com",
  displayName: "Group A",
  memberPubkeys: [],
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
  access: "invite-only",
  memberCount: 0,
  adminPubkeys: [],
});

const createIncomingMessage = (senderPubkey: string): Message => ({
  id: "msg-1",
  kind: "user",
  content: "hello",
  timestamp: new Date(),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: senderPubkey as PublicKeyHex,
});

describe("notification-target-preference", () => {
  beforeEach(() => {
    setProfileScopeOverride("test-profile");
    window.localStorage.clear();
  });

  it("defaults to enabled for dm conversations when no preference is stored", () => {
    expect(isConversationNotificationsEnabled(createDmConversation("a".repeat(64)))).toBe(true);
  });

  it("persists dm conversation preferences and applies them to incoming events", () => {
    const dmConversation = createDmConversation("b".repeat(64));
    setConversationNotificationsEnabled({ conversation: dmConversation, enabled: false });

    expect(isConversationNotificationsEnabled(dmConversation)).toBe(false);
    expect(isMessageNotificationEnabledForIncomingEvent({
      conversationId: dmConversation.id,
      message: createIncomingMessage(dmConversation.pubkey),
    })).toBe(false);
  });

  it("writes group preferences and keeps legacy scoped group key updated", () => {
    const groupConversation = createGroupConversation();
    setConversationNotificationsEnabled({ conversation: groupConversation, enabled: false });

    expect(isConversationNotificationsEnabled(groupConversation)).toBe(false);
    expect(window.localStorage.getItem("obscur_group_notifications_group-a::test-profile")).toBe("off");
  });

  it("falls back to legacy group key when new scoped key is missing", () => {
    window.localStorage.setItem("obscur_group_notifications_group-a::test-profile", "off");

    expect(isConversationNotificationsEnabled(createGroupConversation())).toBe(false);
  });
});
