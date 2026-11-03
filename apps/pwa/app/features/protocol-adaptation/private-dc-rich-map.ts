/**
 * P4h — Private DC canonical → rich shell DTOs (P4g shim helpers).
 * @see specs/backend/platform-p4h-private-dc-capabilities-rich-map-2026-11.md
 */

import type { DmConversation, Message } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CanonicalConversation, CanonicalMessage } from "./types";

const mapMessageStatus = (
  status: CanonicalMessage["status"],
): Message["status"] => {
  if (status === "failed") {
    return "failed";
  }
  if (status === "sending") {
    return "sending";
  }
  if (status === "delivered") {
    return "delivered";
  }
  return "delivered";
};

/** Conversation id in pubkey slot so composer routes private_dc sendDm shim. */
export const mapPrivateDcConversationToRich = (
  row: CanonicalConversation,
): DmConversation => ({
  kind: "dm",
  id: row.id,
  displayName: row.title,
  pubkey: row.id as PublicKeyHex,
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
});

export const mapPrivateDcMessageToRich = (
  row: CanonicalMessage,
): Message => ({
  id: row.id,
  kind: "user",
  content: row.body,
  timestamp: new Date(row.sentAtUnixMs || Date.now()),
  isOutgoing: row.direction === "out",
  status: mapMessageStatus(row.status),
  conversationId: row.conversationId,
  eventId: row.id,
});
