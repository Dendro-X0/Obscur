/**
 * Legacy DM thread-history slices — loaded only via resolve-dm-thread-history-adapter when legacy opt-in.
 * Native sqlite hydrate uses {@link runLegacyNativeDmThreadHydrateReadModel} from the same port.
 */
export { runLegacyDmConversationHydrateReadModelPipeline } from "../dm-conversation-hydrate-pipeline-port";
export { buildLegacyProjectionEvidenceMessagesForConversation } from "./projection-evidence-messages";
export { mergeLegacyProjectionFirstWithLiveOverlayForDisplay } from "./projection-live-merge";
export { loadLegacyEarlierDmConversationMessages } from "./materialization-load-earlier";
export { applyLegacyRealtimeBufferedEvents, applyBufferedEvents } from "./materialization-realtime";
export { runLegacyNativeDmThreadHydrateReadModel } from "./native-dm-thread-hydrate";
export { assembleDmHydrateThreadReadModel } from "./hydrate-read-model";
export {
  loadLegacyConversationWindow,
  loadConversationWindow,
  loadLegacyConversationWindowAcrossAliases,
  loadConversationWindowAcrossAliases,
  loadLegacyInitialDmHydrationIndexedWindow,
  loadInitialDmHydrationIndexedWindow,
  scanLegacyDisplayableHistoryWindow,
  scanDisplayableHistoryWindow,
  mapLegacyIndexedConversationRowsForDisplayableScan,
} from "./hydrate-indexed-legacy-port";
