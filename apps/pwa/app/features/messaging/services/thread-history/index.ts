/**
 * Prefer leaf imports under `@/app/features/messaging/services/thread-history/*`.
 * Root keeps shared contracts only.
 */
export type {
  ThreadKind,
  ThreadCursor,
  ThreadHistoryPaginationConfig,
  ThreadHistoryPage,
} from "./contracts";
export {
  THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT,
  defaultThreadHistoryPaginationConfig,
  toThreadCursor,
  toLoadEarlierParamsFromCursor,
  toThreadHistoryPageFromLoadEarlierResult,
} from "./contracts";
export type { ThreadHistoryPort } from "./port";
export {
  THREAD_HISTORY_OWNER_ID,
  DM_CONVERSATION_MATERIALIZATION_OWNER_ID,
} from "./port";
