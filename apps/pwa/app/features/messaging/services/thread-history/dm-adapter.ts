import { buildProjectionEvidenceMessagesForConversation } from "../dm-conversation-projection-evidence-messages";
import { mergeProjectionFirstWithLiveOverlayForDisplay } from "../dm-conversation-projection-live-merge";
import { runDmConversationHydrateReadModelPipeline } from "../dm-conversation-hydrate-pipeline";
import { loadEarlierDmConversationMessages } from "../dm-conversation-materialization-load-earlier";
import { applyRealtimeBufferedEvents } from "../dm-conversation-materialization-realtime";
import { prepareDmThreadSuppressionIds } from "../dm-thread-suppression-prepare";
import {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "../conversation-message-materialization";
import type { ThreadHistoryPort } from "./port";

/** Live DM adapter for the thread history kernel. */
export const dmThreadHistoryAdapter: ThreadHistoryPort = {
  prepareThreadSuppressionIds: prepareDmThreadSuppressionIds,
  hydrateThreadReadModel: runDmConversationHydrateReadModelPipeline,
  buildProjectionEvidenceMessages: buildProjectionEvidenceMessagesForConversation,
  mergeProjectionWithLiveOverlay: mergeProjectionFirstWithLiveOverlayForDisplay,
  loadEarlierMessages: loadEarlierDmConversationMessages,
  applyRealtimeBufferedEvents,
  filterThreadMessagesBySuppression: filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlay: mergeHydratedBaseWithLiveOverlayMessages,
};

/** @deprecated Use dmThreadHistoryAdapter */
export const dmConversationMaterializationOwner: ThreadHistoryPort = dmThreadHistoryAdapter;
