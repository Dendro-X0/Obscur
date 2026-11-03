/**
 * P7 — first Obscur-Nostr package body leaf: rich shell rows → platform canonical DTOs.
 * Package-local only (no app imports). Input likes are structural (duck-typed against messaging Message/DmConversation).
 */

export type ObscurNostrCanonicalMessage = Readonly<{
  id: string;
  conversationId: string;
  body: string;
  sentAtUnixMs: number;
  direction: "in" | "out";
  status: "sending" | "sent" | "failed" | "delivered";
}>;

export type ObscurNostrCanonicalConversation = Readonly<{
  id: string;
  title: string;
}>;

export type ObscurNostrRichMessageLike = Readonly<{
  id: string;
  content: string;
  conversationId?: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: string;
}>;

export type ObscurNostrRichConversationLike = Readonly<{
  id: string;
  displayName: string;
}>;

const mapMessageStatus = (
  status: string,
): ObscurNostrCanonicalMessage["status"] => {
  if (status === "failed" || status === "rejected") {
    return "failed";
  }
  if (status === "sending" || status === "queued") {
    return "sending";
  }
  if (status === "delivered") {
    return "delivered";
  }
  return "sent";
};

export const mapRichMessageToCanonical = (
  message: ObscurNostrRichMessageLike,
  conversationId: string,
): ObscurNostrCanonicalMessage => ({
  id: message.id,
  conversationId: message.conversationId ?? conversationId,
  body: message.content,
  sentAtUnixMs: message.timestamp.getTime(),
  direction: message.isOutgoing ? "out" : "in",
  status: mapMessageStatus(message.status),
});

export const mapRichConversationToCanonical = (
  conversation: ObscurNostrRichConversationLike,
): ObscurNostrCanonicalConversation => ({
  id: conversation.id,
  title: conversation.displayName,
});
