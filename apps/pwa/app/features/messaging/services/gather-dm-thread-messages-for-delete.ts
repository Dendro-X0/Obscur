/**
 * Collects all DM thread message rows that may back ChatView (controller, chat-state,
 * projection timeline, live overlay) so delete-for-everyone can expand identity ids.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message, PersistedMessage } from "../types";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { messagingChatStateReadPort } from "../services/messaging-chat-state-read-port";
import { buildDmSiblingConversationIds, inferPeerFromConversationId } from "../utils/dm-conversation-sibling-ids";
import { toDmConversationId } from "../utils/dm-conversation-id";

const persistedRowToMessage = (row: PersistedMessage): Message => ({
  id: row.id,
  eventId: row.eventId,
  kind: row.kind ?? "user",
  content: row.content,
  timestamp: new Date(row.timestampMs),
  isOutgoing: row.isOutgoing,
  status: row.status,
  attachments: row.attachments,
  replyTo: row.replyTo,
  reactions: row.reactions,
  deletedAt: row.deletedAtMs !== undefined ? new Date(row.deletedAtMs) : undefined,
});

export const gatherDmThreadMessagesForDelete = (params: Readonly<{
  conversationId: string;
  myPublicKeyHex: PublicKeyHex;
  localMessages?: ReadonlyArray<Message>;
  overlayMessages?: ReadonlyArray<Message>;
}>): ReadonlyArray<Message> => {
  const byId = new Map<string, Message>();

  const add = (message: Message | undefined | null): void => {
    if (!message?.id) {
      return;
    }
    if (!byId.has(message.id)) {
      byId.set(message.id, message);
    }
  };

  for (const message of params.localMessages ?? []) {
    add(message);
  }
  for (const message of params.overlayMessages ?? []) {
    add(message);
  }

  const profileId = getResolvedProfileId();
  if (profileId) {
    const chatState = messagingChatStateReadPort.load(params.myPublicKeyHex, { profileId });
    const siblingIds = buildDmSiblingConversationIds({
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    });
    for (const siblingId of siblingIds) {
      for (const row of chatState?.messagesByConversationId?.[siblingId] ?? []) {
        add(persistedRowToMessage(row));
      }
    }
  }

  const projection = accountProjectionRuntime.getSnapshot().projection;
  if (projection) {
    const conversationIds = new Set<string>(buildDmSiblingConversationIds({
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    }));
    const peer = inferPeerFromConversationId({
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    });
    if (peer) {
      const canonical = toDmConversationId({
        myPublicKeyHex: params.myPublicKeyHex,
        peerPublicKeyHex: peer,
      });
      if (canonical) {
        conversationIds.add(canonical);
      }
    }
    for (const cid of conversationIds) {
      for (const message of selectProjectionConversationMessages({
        projection,
        conversationId: cid,
        myPublicKeyHex: params.myPublicKeyHex,
        limit: 500,
      })) {
        add(message);
      }
    }
  }

  return Array.from(byId.values());
};
