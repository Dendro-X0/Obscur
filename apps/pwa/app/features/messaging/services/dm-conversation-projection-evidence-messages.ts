/**
 * Account projection timeline → evidence `Message[]` for DM hydrate / read authority (R1).
 * Selector + tombstone retention live here; row shaping stays caller-supplied (`normalizeRow`).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { filterMessagesBySuppressedIds } from "./conversation-message-materialization";
import { filterMessagesByLocalRetention } from "./dm-conversation-message-retention-dedupe";

export const buildProjectionEvidenceMessagesForConversation = (params: Readonly<{
  conversationId: string | null | undefined;
  publicKeyHex: PublicKeyHex | string | null | undefined;
  projection: AccountProjectionSnapshot | null;
  limit: number;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
  normalizeRow: (entry: Message) => Message;
}>): ReadonlyArray<Message> => {
  const conversationId = typeof params.conversationId === "string" ? params.conversationId.trim() : "";
  if (!conversationId) {
    return [];
  }
  if (!params.publicKeyHex || typeof params.publicKeyHex !== "string") {
    return [];
  }
  const myPublicKeyHex = params.publicKeyHex as PublicKeyHex;
  const selected = selectProjectionConversationMessages({
    projection: params.projection,
    conversationId,
    myPublicKeyHex,
    limit: params.limit,
  });
  const normalized = filterMessagesBySuppressedIds(
    selected.map((entry) => params.normalizeRow(entry)),
    params.persistentSuppressedMessageIds,
  );
  return filterMessagesByLocalRetention(normalized, params.localMessageRetentionDays);
};
