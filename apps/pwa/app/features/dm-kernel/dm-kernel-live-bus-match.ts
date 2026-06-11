import type { MessageBusEvent } from "@/app/features/messaging/services/message-bus";
import type { Message } from "@/app/features/messaging/types";
import { collectMessageIdentityAliases } from "@/app/features/messaging/services/message-identity-alias-contract";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { inferPeerFromConversationId } from "@/app/features/messaging/utils/dm-conversation-sibling-ids";

export const resolveLiveBusEventConversationId = (event: MessageBusEvent): string => {
  const direct = event.conversationId?.trim() ?? "";
  if (direct.length > 0) {
    return direct;
  }
  if (event.type === "message_deleted") {
    return "";
  }
  return event.message.conversationId?.trim() ?? "";
};

export const doesLiveDmBusEventBelongToThread = (params: Readonly<{
  event: MessageBusEvent;
  conversationAliasIdSet: ReadonlySet<string>;
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
}>): boolean => {
  const eventConversationId = resolveLiveBusEventConversationId(params.event);
  if (eventConversationId.length > 0 && params.conversationAliasIdSet.has(eventConversationId)) {
    return true;
  }
  if (params.event.type === "message_deleted") {
    return false;
  }
  const peerPubkey = inferPeerFromConversationId({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  if (!peerPubkey) {
    return false;
  }
  const sender = normalizePublicKeyHex(params.event.message.senderPubkey ?? "");
  const recipient = normalizePublicKeyHex(params.event.message.recipientPubkey ?? "");
  return sender === peerPubkey || recipient === peerPubkey;
};

const messageRichnessScore = (message: Message): number => {
  let score = 0;
  if (message.eventId?.trim()) {
    score += 4;
  }
  if (message.status === "accepted" || message.status === "delivered") {
    score += 2;
  } else if (message.status === "sending") {
    score += 1;
  }
  return score;
};

export const messagesAreEquivalentForThread = (left: Message, right: Message): boolean => (
  left.id === right.id
  && left.eventId === right.eventId
  && left.status === right.status
  && left.content === right.content
);

export const preferRicherThreadMessage = (existing: Message, incoming: Message): Message => {
  const richer = messageRichnessScore(incoming) >= messageRichnessScore(existing)
    ? incoming
    : existing;
  const poorer = richer === incoming ? existing : incoming;
  return {
    ...poorer,
    ...richer,
    id: existing.id,
    eventId: richer.eventId ?? existing.eventId,
    relayPublishedEventId: richer.relayPublishedEventId ?? existing.relayPublishedEventId,
    status: richer.status,
    content: richer.content,
  };
};

const UUID_MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOSTR_EVENT_ID_PATTERN = /^[0-9a-f]{64}$/i;

const isUuidMessageId = (id: string): boolean => UUID_MESSAGE_ID_PATTERN.test(id.trim());
const isNostrEventId = (id: string): boolean => NOSTR_EVENT_ID_PATTERN.test(id.trim());

/** Links optimistic outgoing UUID rows with persisted nostr-id rows before eventId is attached. */
export const areLikelySameOutgoingLifecycle = (left: Message, right: Message): boolean => {
  if (!left.isOutgoing || !right.isOutgoing) {
    return false;
  }
  if (left.content !== right.content) {
    return false;
  }
  if (Math.abs(left.timestamp.getTime() - right.timestamp.getTime()) > 2_000) {
    return false;
  }
  const leftSender = normalizePublicKeyHex(left.senderPubkey ?? "");
  const rightSender = normalizePublicKeyHex(right.senderPubkey ?? "");
  if (!leftSender || leftSender !== rightSender) {
    return false;
  }
  const leftHasUuid = isUuidMessageId(left.id);
  const rightHasUuid = isUuidMessageId(right.id);
  const leftHasNostrId = isNostrEventId(left.id) || isNostrEventId(left.eventId ?? "");
  const rightHasNostrId = isNostrEventId(right.id) || isNostrEventId(right.eventId ?? "");
  return (leftHasUuid && rightHasNostrId) || (rightHasUuid && leftHasNostrId);
};

export const findThreadMessageIndexByIdentity = (
  messages: ReadonlyArray<Message>,
  target: Message,
): number => {
  const targetAliases = new Set(collectMessageIdentityAliases(target));
  if (targetAliases.size > 0) {
    const aliasIndex = messages.findIndex((message) => (
      collectMessageIdentityAliases(message).some((alias) => targetAliases.has(alias))
    ));
    if (aliasIndex >= 0) {
      return aliasIndex;
    }
  }
  return messages.findIndex((message) => areLikelySameOutgoingLifecycle(message, target));
};

export const upsertDmKernelThreadMessage = (
  messages: ReadonlyArray<Message>,
  incoming: Message,
): Message[] => {
  const index = findThreadMessageIndexByIdentity(messages, incoming);
  if (index >= 0) {
    const merged = preferRicherThreadMessage(messages[index], incoming);
    if (messagesAreEquivalentForThread(messages[index], merged)) {
      return messages as Message[];
    }
    const next = [...messages];
    next[index] = merged;
    return next.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  }
  return [...messages, incoming]
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

export const mergeDmKernelThreadMessages = (
  base: ReadonlyArray<Message>,
  overlay: ReadonlyArray<Message>,
): Message[] => {
  let merged = [...base];
  for (const message of overlay) {
    merged = upsertDmKernelThreadMessage(merged, message);
  }
  return merged;
};
