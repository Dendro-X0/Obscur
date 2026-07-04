/**
 * Account projection timeline → evidence Message[] for DM hydrate / read authority (R1).
 * Web legacy thread-history path only; native uses dm-kernel.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { selectProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { filterMessagesBySuppressedIds } from "@/app/features/messaging/services/conversation-message-materialization";
import { filterMessagesByLocalRetention } from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";
import type { BuildProjectionEvidenceMessagesParams } from "./projection-evidence-types";

export type { BuildProjectionEvidenceMessagesParams } from "./projection-evidence-types";

export const buildLegacyProjectionEvidenceMessagesForConversation = (
  params: BuildProjectionEvidenceMessagesParams,
): ReadonlyArray<Message> => {
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

/** @deprecated Use buildLegacyProjectionEvidenceMessagesForConversation */
export const buildProjectionEvidenceMessagesForConversation = buildLegacyProjectionEvidenceMessagesForConversation;
