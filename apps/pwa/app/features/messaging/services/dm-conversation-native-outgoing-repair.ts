/**
 * Desktop sqlite hydrate does not read profile-scoped chat-state. Outgoing DMs are still
 * mirrored there when the message bus persists (including before sqlite receives eventId).
 * Repair missing self-authored history into the thread and sqlite on hydrate.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isTauri, dbInsertMessage } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import type { Message, PersistedMessage } from "../types";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

const toNativeOutgoingMessageRecord = (
  message: Message,
  profileId: string,
): MessageRecord | null => {
  const eventId = message.eventId?.trim() || message.id?.trim();
  const conversationId = message.conversationId?.trim();
  if (!eventId || !conversationId) {
    return null;
  }
  const idLooksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  const hasRealEventId = typeof message.eventId === "string" && message.eventId.trim().length > 0;
  if (idLooksLikeUuid && !hasRealEventId) {
    return null;
  }
  return {
    event_id: eventId,
    profile_id: profileId,
    conversation_id: conversationId,
    sender_pubkey: typeof message.senderPubkey === "string" ? message.senderPubkey : "",
    recipient_pubkey: typeof message.recipientPubkey === "string" ? message.recipientPubkey : "",
    plaintext: typeof message.content === "string" ? message.content : "",
    kind: typeof message.kind === "number" ? message.kind : 4,
    created_at: Math.floor(message.timestamp.getTime() / 1000),
    received_at: message.timestamp.getTime(),
    is_outgoing: true,
    reply_to_event_id: null,
    has_attachment: false,
  };
};

export const loadNativeOutgoingChatStateRepairMessages = (params: Readonly<{
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): ReadonlyArray<Message> => {
  if (!isTauri() || params.conversationIds.length === 0) {
    return [];
  }

  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId,
    accountPublicKeyHex: params.myPublicKeyHex,
  });

  const mergedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {};
  profileIds.forEach((profileId) => {
    const persistedState = chatStateStoreService.load(params.myPublicKeyHex, { profileId });
    if (!persistedState?.messagesByConversationId) {
      return;
    }
    Object.entries(persistedState.messagesByConversationId).forEach(([conversationId, rows]) => {
      const existing = mergedMessagesByConversationId[conversationId] ?? [];
      mergedMessagesByConversationId[conversationId] = [...existing, ...rows];
    });
  });

  if (Object.keys(mergedMessagesByConversationId).length === 0) {
    return [];
  }

  const normalizedByConversation = fromPersistedMessagesByConversationId(
    mergedMessagesByConversationId,
    { myPublicKeyHex: params.myPublicKeyHex },
  );

  const scope = new Set(
    params.conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  const myPublicKeyHex = normalizePublicKeyHex(params.myPublicKeyHex);
  const repaired: Message[] = [];

  scope.forEach((conversationId) => {
    const rows = normalizedByConversation[conversationId] ?? [];
    rows.forEach((row) => {
      const senderPubkey = normalizePublicKeyHex(row.senderPubkey);
      const isSelfOutgoing = row.isOutgoing === true || (
        myPublicKeyHex !== null && senderPubkey === myPublicKeyHex
      );
      if (!isSelfOutgoing || !isDisplayableDmConversationMessage(row)) {
        return;
      }
      const record = toNativeOutgoingMessageRecord(row, params.profileId);
      if (record) {
        void dbInsertMessage(record).catch(() => undefined);
      }
      repaired.push(row);
    });
  });

  return repaired;
};
