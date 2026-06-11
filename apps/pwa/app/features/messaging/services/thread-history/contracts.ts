/**
 * Thread History Kernel — shared pagination and cursor contracts (DM + group).
 */

import type { Message } from "../../types";
import type { LoadEarlierDmConversationMessagesParams } from "../dm-conversation-materialization-load-earlier";
import type { LoadEarlierDmConversationMessagesResult } from "../dm-conversation-materialization-load-earlier";

export type ThreadKind = "dm" | "group";

/** Stable cursor for paging older messages from durable storage. */
export type ThreadCursor = Readonly<{
  beforeTimestampMs: number;
  beforeEventId?: string;
}>;

export const THREAD_HISTORY_DEFAULT_PAGE_SIZE = 200;
export const THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT = 200;

export type ThreadHistoryPaginationConfig = Readonly<{
  pageSize: number;
  liveWindowSoftLimit: number;
}>;

export const defaultThreadHistoryPaginationConfig = (): ThreadHistoryPaginationConfig => ({
  pageSize: THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  liveWindowSoftLimit: THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT,
});

/** Normalized page result — maps DM load-earlier and future group paging. */
export type ThreadHistoryPage<TMessage = Message> = Readonly<{
  messages: ReadonlyArray<TMessage>;
  hasEarlier: boolean;
  didExpandHistory: boolean;
  nextCursor: ThreadCursor | null;
}>;

export const toThreadCursor = (beforeTimestampMs: number, beforeEventId?: string): ThreadCursor => ({
  beforeTimestampMs,
  ...(beforeEventId ? { beforeEventId } : {}),
});

export const toLoadEarlierParamsFromCursor = (
  params: Readonly<{
    base: Omit<LoadEarlierDmConversationMessagesParams, "earliestTimestampMs" | "loadEarlierBatchSize">;
    cursor: ThreadCursor;
    pageSize: number;
  }>,
): LoadEarlierDmConversationMessagesParams => ({
  ...params.base,
  earliestTimestampMs: params.cursor.beforeTimestampMs,
  loadEarlierBatchSize: params.pageSize,
});

export const toThreadHistoryPageFromLoadEarlierResult = (
  result: LoadEarlierDmConversationMessagesResult,
): ThreadHistoryPage<Message> => {
  const earliest = result.messages[0];
  const earliestMs = earliest?.timestamp instanceof Date ? earliest.timestamp.getTime() : null;
  return {
    messages: result.messages,
    hasEarlier: result.hasEarlier,
    didExpandHistory: result.didExpandHistory,
    nextCursor: result.hasEarlier && earliestMs !== null
      ? toThreadCursor(earliestMs, earliest.eventId)
      : null,
  };
};
