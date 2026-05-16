/**
 * Row → displayable Message mapping for IndexedDB / SQLite hydrate windows (R1).
 * I/O stays in `dm-conversation-hydrate-indexed-scan.ts`; raw→`Message` normalize stays caller-supplied (typically **`normalizeDmConversationMessageRow`**); display predicate typically **`isDisplayableDmConversationMessage`** (`dm-conversation-displayable-message.ts`).
 * Retention + identity dedupe use `dm-conversation-message-retention-dedupe.ts`.
 */

import type { Message } from "../types";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import {
  dedupeMessagesByIdentity,
  filterMessagesByLocalRetention,
} from "./dm-conversation-message-retention-dedupe";

export type IndexedHydrationMapPipeline = "initial_hydrate" | "load_earlier";

/**
 * Maps raw store rows (newest-last from `getAllByIndex` "prev") into displayable messages for scan passes.
 *
 * - **initial_hydrate:** tombstone filter → dedupe → retention → `isDisplayable` (matches hydrate scan target counts).
 * - **load_earlier:** `isDisplayable` + tombstone → dedupe → retention (matches pagination prepend).
 */
export const mapIndexedConversationRowsForDisplayableScan = (params: Readonly<{
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
