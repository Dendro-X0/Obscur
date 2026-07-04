import { buildLegacyProjectionEvidenceMessagesForConversation, loadLegacyEarlierDmConversationMessages, mergeLegacyProjectionFirstWithLiveOverlayForDisplay, applyLegacyRealtimeBufferedEvents, runLegacyDmConversationHydrateReadModelPipeline, } from "./dm-thread-history-legacy-port";
import { prepareDmThreadSuppressionIds } from "../dm-thread-suppression-prepare";
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "../conversation-message-materialization";
import type { ThreadHistoryPort } from "./port";

/** Live DM adapter for the thread history kernel. */
export const dmThreadHistoryAdapter: ThreadHistoryPort = {
  prepareThreadSuppressionIds: prepareDmThreadSuppressionIds,
  hydrateThreadReadModel: runLegacyDmConversationHydrateReadModelPipeline,
  buildProjectionEvidenceMessages: buildLegacyProjectionEvidenceMessagesForConversation,
  mergeProjectionWithLiveOverlay: mergeLegacyProjectionFirstWithLiveOverlayForDisplay,
  loadEarlierMessages: loadLegacyEarlierDmConversationMessages,
  applyRealtimeBufferedEvents: applyLegacyRealtimeBufferedEvents,
  filterThreadMessagesBySuppression: filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlay: mergeHydratedBaseWithLiveOverlayMessages,
};

/** @deprecated Use dmThreadHistoryAdapter */
export const dmConversationMaterializationOwner: ThreadHistoryPort = dmThreadHistoryAdapter;
