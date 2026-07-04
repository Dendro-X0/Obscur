/**
 * Load-earlier pagination for web legacy thread-history path.
 */

import type { Message } from "@/app/features/messaging/types";
import { normalizeDmConversationMessageRow } from "@/app/features/messaging/services/dm-conversation-normalize-message";
import { isDisplayableDmConversationMessage } from "@/app/features/messaging/services/dm-conversation-displayable-message";
import { dedupeMessagesByIdentity } from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";
import type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "./load-earlier-types";
import {
  loadLegacyConversationWindowAcrossAliases,
  mapLegacyIndexedConversationRowsForDisplayableScan,
  scanLegacyDisplayableHistoryWindow,
} from "./hydrate-indexed-legacy-port";

export type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "./load-earlier-types";

export const loadLegacyEarlierDmConversationMessages = async (
  params: LoadEarlierDmConversationMessagesParams,
): Promise<LoadEarlierDmConversationMessagesResult> => {
  const earlierWindow = await loadLegacyConversationWindowAcrossAliases({
    conversationIds: params.conversationAliasIds,
    limit: params.loadEarlierBatchSize,
    beforeTimestampMs: params.earliestTimestampMs,
    accountPublicKeyHex: params.publicKeyHex,
  });

  if (earlierWindow.rows.length === 0) {
    return {
      messages: params.existingMessages,
      hasEarlier: false,
      didExpandHistory: false,
    };
  }

  const mapRowsToDisplayableMessages = (rows: ReadonlyArray<unknown>): ReadonlyArray<Message> => (
    mapLegacyIndexedConversationRowsForDisplayableScan({
      pipeline: "load_earlier",
      rows,
      normalizeRow: (row: unknown) => normalizeDmConversationMessageRow(row, {
        conversationId: typeof (row as { conversationId?: string })?.conversationId === "string"
          ? (row as { conversationId: string }).conversationId
          : params.conversationId,
        myPublicKeyHex: params.publicKeyHex,
      }),
      persistentSuppressedMessageIds: params.persistentSuppressedMessageIds,
      isDisplayable: isDisplayableDmConversationMessage,
      localMessageRetentionDays: params.localMessageRetentionDays,
    })
  );

  const scannedWindow = await scanLegacyDisplayableHistoryWindow({
    conversationIds: params.conversationAliasIds,
    initialRows: earlierWindow.rows,
    initialHasEarlier: earlierWindow.hasEarlier,
    limit: params.loadEarlierBatchSize,
    mapRows: mapRowsToDisplayableMessages,
    accountPublicKeyHex: params.publicKeyHex,
  });

  if (scannedWindow.messages.length === 0) {
    return {
      messages: params.existingMessages,
      hasEarlier: scannedWindow.hasEarlier,
      didExpandHistory: false,
    };
  }

  return {
    messages: dedupeMessagesByIdentity([...scannedWindow.messages, ...params.existingMessages]),
    hasEarlier: scannedWindow.hasEarlier && scannedWindow.messages.length > 0,
    didExpandHistory: true,
  };
};

/** @deprecated Use loadLegacyEarlierDmConversationMessages */
export const loadEarlierDmConversationMessages = loadLegacyEarlierDmConversationMessages;
