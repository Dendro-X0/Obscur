/**
 * Desktop sqlite hydrate ignores chat-state fallback. Outgoing community invite and
 * invite-response rows are still written to profile-scoped chat-state — repair them into
 * the thread (and sqlite) on hydrate.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isTauri, dbInsertMessage } from "@dweb/db";
import type { MessageRecord } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { toCanonicalCommunityDmInviteThreadMessage } from "@/app/features/groups/services/community-dm-invite-pipeline";
import {
  parseCommunityInviteResponseWirePayload,
  parseCommunityInviteWirePayload,
  parseMessageContentJson,
} from "@/app/features/groups/services/community-dm-invite-contract";
import { chatStateStoreService } from "./chat-state-store";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import type { Message, PersistedMessage } from "../types";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";

const isOutgoingCommunityInviteThreadContent = (content: string): boolean => {
  const parsed = parseMessageContentJson(content);
  return (
    parseCommunityInviteWirePayload(parsed) !== null
    || parseCommunityInviteResponseWirePayload(parsed) !== null
  );
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

const mergeChatStateMessagesByConversation = (
  profileIds: ReadonlyArray<string>,
  myPublicKeyHex: PublicKeyHex,
): Record<string, ReadonlyArray<PersistedMessage>> => {
  const merged: Record<string, PersistedMessage[]> = {};
  profileIds.forEach((profileId) => {
    const persistedState = chatStateStoreService.load(myPublicKeyHex, { profileId });
    if (!persistedState?.messagesByConversationId) {
      return;
    }
    Object.entries(persistedState.messagesByConversationId).forEach(([conversationId, rows]) => {
      const existing = merged[conversationId] ?? [];
      merged[conversationId] = [...existing, ...rows];
    });
  });
  return merged;
};

export const loadNativeOutgoingCommunityInviteRepairMessages = (params: Readonly<{
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
  const mergedMessagesByConversation = mergeChatStateMessagesByConversation(
    profileIds,
    params.myPublicKeyHex,
  );
  if (Object.keys(mergedMessagesByConversation).length === 0) {
    return [];
  }

  const normalizedByConversation = fromPersistedMessagesByConversationId(
    mergedMessagesByConversation,
    { myPublicKeyHex: params.myPublicKeyHex },
  );

  const myPublicKeyHex = normalizePublicKeyHex(params.myPublicKeyHex);
  const repaired: Message[] = [];
  params.conversationIds.forEach((conversationId) => {
    const rows = normalizedByConversation[conversationId] ?? [];
    rows.forEach((row) => {
      const senderPubkey = normalizePublicKeyHex(row.senderPubkey);
      const isSelfOutgoing = row.isOutgoing === true || (
        myPublicKeyHex !== null && senderPubkey === myPublicKeyHex
      );
      if (!isSelfOutgoing || typeof row.content !== "string" || !isOutgoingCommunityInviteThreadContent(row.content)) {
        return;
      }
      if (!isDisplayableDmConversationMessage(row)) {
        return;
      }
      const canonical = toCanonicalCommunityDmInviteThreadMessage(row);
      const record = toNativeInviteMessageRecord(canonical, params.profileId);
      if (record) {
        void dbInsertMessage(record).catch(() => undefined);
      }
      repaired.push(canonical);
    });
  });

  return repaired;
};
