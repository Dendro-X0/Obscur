/**
 * Row → displayable Message mapping for IndexedDB / SQLite hydrate windows.
 */

import type { Message } from "@/app/features/messaging/types";
import { isMessageIdentityInSuppressedIdSet } from "@/app/features/messaging/services/conversation-message-visibility";
import {
  dedupeMessagesByIdentity,
  filterMessagesByLocalRetention,
} from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";

export type IndexedHydrationMapPipeline = "initial_hydrate" | "load_earlier" | "native_sqlite_hydrate";

/**
 * Maps raw store rows (newest-last from `getAllByIndex` "prev") into displayable messages for scan passes.
 */
export const mapLegacyIndexedConversationRowsForDisplayableScan = (params: Readonly<{
  pipeline: IndexedHydrationMapPipeline;
  rows: ReadonlyArray<any>;
  normalizeRow: (raw: any) => Message;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  isDisplayable: (message: Message) => boolean;
  localMessageRetentionDays: number | undefined;
}>): ReadonlyArray<Message> => {
  const mapped = params.rows.slice().reverse().map((row) => params.normalizeRow(row));
  if (params.pipeline === "load_earlier") {
    const filtered = mapped.filter((message) => (
      params.isDisplayable(message)
      && !isMessageIdentityInSuppressedIdSet(message, params.persistentSuppressedMessageIds)
    ));
    return filterMessagesByLocalRetention(
      dedupeMessagesByIdentity(filtered),
      params.localMessageRetentionDays,
    );
  }
  const tombstoneFiltered = mapped.filter((message) => (
    !isMessageIdentityInSuppressedIdSet(message, params.persistentSuppressedMessageIds)
  ));
  return filterMessagesByLocalRetention(
    dedupeMessagesByIdentity(tombstoneFiltered),
    params.localMessageRetentionDays,
  ).filter(params.isDisplayable);
};

/** @deprecated Use mapLegacyIndexedConversationRowsForDisplayableScan */
export const mapIndexedConversationRowsForDisplayableScan = mapLegacyIndexedConversationRowsForDisplayableScan;
