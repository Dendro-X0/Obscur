/**
 * R1 subtraction — native desktop DM thread history port.
 * SQLite hydrate + live bus only; projection paths are explicit no-ops.
 */

import {
  applyLegacyRealtimeBufferedEvents,
  loadLegacyEarlierDmConversationMessages,
  runLegacyNativeDmThreadHydrateReadModel,
} from "./dm-thread-history-legacy-port";
import { prepareDmThreadSuppressionIds } from "../dm-thread-suppression-prepare";
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "../conversation-message-materialization";
import type { ThreadHistoryPort } from "./port";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./projection-live-merge-types";

const noopProjectionMerge = (
  params: MergeProjectionFirstWithLiveOverlayForDisplayParams,
): MergeProjectionFirstWithLiveOverlayForDisplayResult => ({
  retentionFilteredNextMessages: params.previousMessages,
  shouldCapToLiveWindow: false,
  mergedMessageCount: params.previousMessages.length,
  cappedMessageCount: params.previousMessages.length,
});

export const nativeDmThreadHistoryAdapter: ThreadHistoryPort = {
  prepareThreadSuppressionIds: prepareDmThreadSuppressionIds,
  hydrateThreadReadModel: runLegacyNativeDmThreadHydrateReadModel,
  buildProjectionEvidenceMessages: () => [],
  mergeProjectionWithLiveOverlay: noopProjectionMerge,
  loadEarlierMessages: loadLegacyEarlierDmConversationMessages,
  applyRealtimeBufferedEvents: applyLegacyRealtimeBufferedEvents,
  filterThreadMessagesBySuppression: filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlay: mergeHydratedBaseWithLiveOverlayMessages,
};
