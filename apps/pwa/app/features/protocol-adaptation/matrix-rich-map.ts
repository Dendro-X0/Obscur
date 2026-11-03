/**
 * C3 — Matrix room/timeline → rich + canonical DTOs.
 * @see specs/backend/platform-c3-matrix-capabilities-rich-map-2026-11.md
 */

import type { DmConversation, Message } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CanonicalMessage } from "./types";

export type MatrixRoomLike = Readonly<{
  roomId: string;
  title: string;
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
}>;

export type MatrixTimelineEntryLike = Readonly<{
  eventId: string;
  roomId: string;
  body: string;
  sentAtUnixMs: number;
  senderUserId: string;
}>;

/** Room id in pubkey slot so composer peerPublicKeyInput routes Matrix send. */
export const mapMatrixRoomToRichConversation = (
  room: MatrixRoomLike,
): DmConversation => ({
  kind: "dm",
  id: room.roomId,
  displayName: room.title,
  pubkey: room.roomId as PublicKeyHex,
  lastMessage: room.lastMessagePreview,
  unreadCount: 0,
  lastMessageTime: new Date(room.lastMessageAtUnixMs || Date.now()),
});

export const mapMatrixTimelineToRichMessage = (
  entry: MatrixTimelineEntryLike,
  myUserId: string,
): Message => ({
  id: entry.eventId,
  kind: "user",
  content: entry.body,
  timestamp: new Date(entry.sentAtUnixMs || Date.now()),
  isOutgoing: entry.senderUserId === myUserId,
  status: "delivered",
  conversationId: entry.roomId,
  eventId: entry.eventId,
});

export const mapMatrixTimelineToCanonical = (
  entry: MatrixTimelineEntryLike,
  myUserId: string,
): CanonicalMessage => ({
  id: entry.eventId,
  conversationId: entry.roomId,
  body: entry.body,
  sentAtUnixMs: entry.sentAtUnixMs || Date.now(),
  direction: entry.senderUserId === myUserId ? "out" : "in",
  status: "delivered",
});
