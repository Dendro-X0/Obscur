/**
 * C3 performance budgets for protocol adaptation surfaces.
 * Soft L3 Fixed / remount bands remain PAUSED — these are advisory L1 constants only.
 */

export const PROTOCOL_ADAPTATION_PERF_BUDGETS = {
  /** Matrix /_sync filter timeline limit per room join payload. */
  matrixSyncTimelineLimit: 20,
  /** Matrix room messages page size. */
  matrixRoomMessagesLimit: 50,
  /** Sidebar conversation list soft cap before UI should virtualize (hint). */
  sidebarConversationSoftCap: 200,
  /** Max time for one Matrix sync request before UI should show warming (ms). */
  matrixSyncUiWarmingMs: 8_000,
} as const;

export type ProtocolAdaptationPerfBudgets = typeof PROTOCOL_ADAPTATION_PERF_BUDGETS;
