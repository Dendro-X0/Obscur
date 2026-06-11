/**
 * R1 subtraction — native desktop DM thread history port.
 * SQLite hydrate + live bus only; projection paths are explicit no-ops.
 */

import { applyRealtimeBufferedEvents } from "../dm-conversation-materialization-realtime";
import { loadEarlierDmConversationMessages } from "../dm-conversation-materialization-load-earlier";
import { runNativeDmThreadHydrateReadModel } from "../native-dm-thread-hydrate";
import { prepareDmThreadSuppressionIds } from "../dm-thread-suppression-prepare";
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "../conversation-message-materialization";
import type { ThreadHistoryPort } from "./port";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "../dm-conversation-projection-live-merge";

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
  hydrateThreadReadModel: runNativeDmThreadHydrateReadModel,
  buildProjectionEvidenceMessages: () => [],
  mergeProjectionWithLiveOverlay: noopProjectionMerge,
  loadEarlierMessages: loadEarlierDmConversationMessages,
  applyRealtimeBufferedEvents,
  filterThreadMessagesBySuppression: filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlay: mergeHydratedBaseWithLiveOverlayMessages,
};
