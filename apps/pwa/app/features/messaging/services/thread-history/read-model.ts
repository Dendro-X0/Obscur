/**
 * Thread History Kernel — display read-model policy (monotonic depth, expanded history).
 */
export { THREAD_HISTORY_LIVE_WINDOW_SOFT_LIMIT } from "./contracts";

export {
  DM_THREAD_DIRECTION_COVERAGE_HYDRATE_MAX_ATTEMPTS,
  DM_THREAD_LIVE_WINDOW_SOFT_LIMIT,
  DM_THREAD_PARTIAL_DIRECTION_HYDRATE_BASE_DELAY_MS,
  DM_THREAD_PARTIAL_DIRECTION_HYDRATE_MAX_ATTEMPTS,
  DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS,
  DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS,
  reconcileMonotonicLoadedDepth,
  resolveExpandedHistoryAfterHydrate,
  finalizeDmThreadHydrateRead,
  evaluateDirectionCoverage,
  evaluatePartialDirectionHydrateRetryPolicy,
  evaluateProjectionMergePolicy,
  evaluateStaleEmptyHydrateRetryPolicy,
  hasPartialDirectionCoverage,
  reconcileDirectionCoverage,
  resolveDisplayMessagesWithCacheFallback,
  resolveInitialConversationPaint,
  shouldPersistDmThreadDisplayCache,
  buildHydrateSupplementalMessages,
} from "../dm-thread-read-model";
