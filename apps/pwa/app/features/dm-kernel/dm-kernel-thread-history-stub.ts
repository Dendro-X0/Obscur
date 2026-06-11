/**
 * Inert thread-history port under dm-kernel — blocks hydrate/projection re-entry on native.
 */
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "@/app/features/messaging/services/thread-message-list-utils";
import type { Message } from "@/app/features/messaging/types";
import type { ThreadHistoryPort } from "@/app/features/messaging/services/thread-history/port";

import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "@/app/features/messaging/services/dm-conversation-projection-live-merge";

const emptyHydrateResult = {
  finalMessages: [] as ReadonlyArray<Message>,
  authorityDecision: {
    authority: "indexed" as const,
    reason: "indexed_primary" as const,
  },
  hasEarlier: false,
  projectionFallbackHydration: false,
  authorityDiagnosticKey: "dm_kernel_stub",
  authorityLogContext: { feature: "messaging", action: "dm_kernel_thread_history_stub" },
  hydrationDiagnosticsLogContext: null,
  hydrated: [] as ReadonlyArray<Message>,
  mappedDirectionCounts: { outgoing: 0, incoming: 0 },
};

const noopProjectionMerge = (
  params: MergeProjectionFirstWithLiveOverlayForDisplayParams,
): MergeProjectionFirstWithLiveOverlayForDisplayResult => ({
  retentionFilteredNextMessages: params.previousMessages,
  shouldCapToLiveWindow: false,
  mergedMessageCount: params.previousMessages.length,
  cappedMessageCount: params.previousMessages.length,
});

export const dmKernelThreadHistoryStub: ThreadHistoryPort = {
  prepareThreadSuppressionIds: async () => new Set<string>(),
  hydrateThreadReadModel: async () => emptyHydrateResult,
  buildProjectionEvidenceMessages: () => [],
  mergeProjectionWithLiveOverlay: noopProjectionMerge,
  loadEarlierMessages: async () => ({
    messages: [],
    hasEarlier: false,
    didExpandHistory: false,
  }),
  applyRealtimeBufferedEvents: (params) => [...params.previous],
  filterThreadMessagesBySuppression: filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlay: mergeHydratedBaseWithLiveOverlayMessages,
};
