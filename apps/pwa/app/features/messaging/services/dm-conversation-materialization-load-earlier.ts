import type { Message } from "../types";
import { mapIndexedConversationRowsForDisplayableScan } from "./dm-conversation-hydrate-indexed-map-rows";
import {
  loadConversationWindowAcrossAliases,
  scanDisplayableHistoryWindow,
} from "./dm-conversation-hydrate-indexed-scan";
import { normalizeDmConversationMessageRow } from "./dm-conversation-normalize-message";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { dedupeMessagesByIdentity } from "./dm-conversation-message-retention-dedupe";

export type LoadEarlierDmConversationMessagesParams = Readonly<{
  conversationId: string;
  conversationAliasIds: ReadonlyArray<string>;
  earliestTimestampMs: number;
  loadEarlierBatchSize: number;
  publicKeyHex: string | null;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
  existingMessages: ReadonlyArray<Message>;
}>;

export type LoadEarlierDmConversationMessagesResult = Readonly<{
  messages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  didExpandHistory: boolean;
}>;

export const loadEarlierDmConversationMessages = async (
  params: LoadEarlierDmConversationMessagesParams,
): Promise<LoadEarlierDmConversationMessagesResult> => {
  const earlierWindow = await loadConversationWindowAcrossAliases({
    conversationIds: params.conversationAliasIds,
    limit: params.loadEarlierBatchSize,
    beforeTimestampMs: params.earliestTimestampMs,
  });

  if (earlierWindow.rows.length === 0) {
    return {
      messages: params.existingMessages,
      hasEarlier: false,
      didExpandHistory: false,
    };
  }

  const mapRowsToDisplayableMessages = (rows: ReadonlyArray<unknown>): ReadonlyArray<Message> => (
    mapIndexedConversationRowsForDisplayableScan({
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

  const scannedWindow = await scanDisplayableHistoryWindow({
    conversationIds: params.conversationAliasIds,
    initialRows: earlierWindow.rows,
    initialHasEarlier: earlierWindow.hasEarlier,
    limit: params.loadEarlierBatchSize,
    mapRows: mapRowsToDisplayableMessages,
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
