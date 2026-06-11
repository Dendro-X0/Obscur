import { describe, expect, it } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import type { MessageBusEvent } from "@/app/features/messaging/services/message-bus";
import {
  doesLiveDmBusEventBelongToThread,
  mergeDmKernelThreadMessages,
  resolveLiveBusEventConversationId,
} from "./dm-kernel-live-bus-match";
import { buildDmSiblingConversationIds } from "@/app/features/messaging/utils/dm-conversation-sibling-ids";

const myPublicKeyHex = "a".repeat(64);
const peerPublicKeyHex = "b".repeat(64);
const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

const createIncomingEvent = (
  overrides: Partial<Message> = {},
  conversationId = canonicalConversationId,
): Extract<MessageBusEvent, { type: "new_message" }> => ({
  type: "new_message",
  conversationId,
  message: {
    id: "evt-1",
    kind: "user",
    content: "hello",
    timestamp: new Date(1_717_000_000_000),
    isOutgoing: false,
    status: "delivered",
    senderPubkey: peerPublicKeyHex,
    recipientPubkey: myPublicKeyHex,
    conversationId,
    ...overrides,
  },
});

describe("dm-kernel live bus match", () => {
  it("resolves conversation id from nested message when bus envelope id is empty", () => {
    const event: MessageBusEvent = {
      type: "new_message",
      conversationId: "",
      message: createIncomingEvent().message,
    };
    expect(resolveLiveBusEventConversationId(event)).toBe(canonicalConversationId);
  });

  it("matches events by either participant pubkey when alias ids differ", () => {
    const legacyConversationId = peerPublicKeyHex;
    const aliasIds = new Set(buildDmSiblingConversationIds({
      conversationId: legacyConversationId,
      myPublicKeyHex,
    }));
    const event = createIncomingEvent({}, "unexpected:conversation:id");

    expect(doesLiveDmBusEventBelongToThread({
      event,
      conversationAliasIdSet: aliasIds,
      conversationId: legacyConversationId,
      myPublicKeyHex,
    })).toBe(true);
  });

  it("collapses optimistic uuid and persisted event id into one outgoing row", () => {
    const optimisticId = "550e8400-e29b-41d4-a716-446655440000";
    const eventId = "c".repeat(64);
    const optimistic: Message = {
      id: optimisticId,
      kind: "user",
      content: "test",
      timestamp: new Date(2_000),
      isOutgoing: true,
      status: "sending",
      senderPubkey: myPublicKeyHex,
      recipientPubkey: peerPublicKeyHex,
      conversationId: canonicalConversationId,
    };
    const persisted: Message = {
      id: eventId,
      eventId,
      kind: "user",
      content: "test",
      timestamp: new Date(2_000),
      isOutgoing: true,
      status: "accepted",
      senderPubkey: myPublicKeyHex,
      recipientPubkey: peerPublicKeyHex,
      conversationId: canonicalConversationId,
    };

    const merged = mergeDmKernelThreadMessages([optimistic], [persisted]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(optimisticId);
    expect(merged[0]?.eventId).toBe(eventId);
    expect(merged[0]?.status).toBe("accepted");
  });

  it("merges sqlite and live rows without dropping bus-only messages", () => {
    const sqliteRow: Message = {
      id: "old-1",
      kind: "user",
      content: "old",
      timestamp: new Date(1_000),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: peerPublicKeyHex,
      conversationId: canonicalConversationId,
    };
    const liveRow: Message = {
      id: "new-1",
      kind: "user",
      content: "live",
      timestamp: new Date(2_000),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: peerPublicKeyHex,
      conversationId: canonicalConversationId,
    };

    expect(mergeDmKernelThreadMessages([sqliteRow], [liveRow]).map((message) => message.id)).toEqual([
      "old-1",
      "new-1",
    ]);
  });
});
