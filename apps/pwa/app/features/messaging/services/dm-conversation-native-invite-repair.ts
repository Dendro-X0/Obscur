/**
 * Desktop sqlite hydrate ignores chat-state fallback. Outgoing community invites are still
 * written to profile-scoped chat-state when sent from group invite dialogs — repair them into
 * the thread (and sqlite) on hydrate.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isTauri, dbInsertMessage } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import type { Message } from "../types";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import { toCanonicalOutgoingCommunityInviteMessage } from "@/app/features/groups/utils/community-invite-dm-local-evidence";

const isCommunityInviteContent = (content: string): boolean => {
  try {
    const parsed = normalizeCommunityInvitePayload(JSON.parse(content));
    return parsed?.type === "community-invite";
  } catch {
    return false;
  }
};

const toNativeInviteMessageRecord = (
  message: Message,
  profileId: string,
): MessageRecord | null => {
  const eventId = message.eventId?.trim() || message.id?.trim();
  const conversationId = message.conversationId?.trim();
  if (!eventId || !conversationId) {
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
    is_outgoing: message.isOutgoing === true,
    reply_to_event_id: null,
    has_attachment: false,
  };
};

export const loadNativeOutgoingCommunityInviteRepairMessages = (params: Readonly<{
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex;
  profileId: string;
}>): ReadonlyArray<Message> => {
  if (!isTauri() || params.conversationIds.length === 0) {
    return [];
  }

  const persistedState = chatStateStoreService.load(params.myPublicKeyHex, {
    profileId: params.profileId,
  });
  if (!persistedState?.messagesByConversationId) {
    return [];
  }

  const normalizedByConversation = fromPersistedMessagesByConversationId(
    persistedState.messagesByConversationId,
    { myPublicKeyHex: params.myPublicKeyHex },
  );

  const repaired: Message[] = [];
  params.conversationIds.forEach((conversationId) => {
    const rows = normalizedByConversation[conversationId] ?? [];
    rows.forEach((row) => {
      if (!row.isOutgoing || typeof row.content !== "string" || !isCommunityInviteContent(row.content)) {
        return;
      }
      if (!isDisplayableDmConversationMessage(row)) {
        return;
      }
      const canonical = toCanonicalOutgoingCommunityInviteMessage(row);
      const record = toNativeInviteMessageRecord(canonical, params.profileId);
      if (record) {
        void dbInsertMessage(record).catch(() => undefined);
      }
      repaired.push(canonical);
    });
  });

  return repaired;
};
