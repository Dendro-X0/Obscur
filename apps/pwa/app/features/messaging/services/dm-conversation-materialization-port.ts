/**
 * @deprecated Import from `thread-history/port` — retained for gateway bind migration.
 */
export {
  THREAD_HISTORY_OWNER_ID,
  DM_CONVERSATION_MATERIALIZATION_OWNER_ID,
  type ThreadHistoryPort,
  type DmConversationMaterializationPort,
  type DmConversationHydratePipelineNumericConfig,
  type RunDmConversationHydrateReadModelPipelineParams,
  type AssembleDmHydrateThreadReadModelResult,
  type LoadEarlierDmConversationMessagesParams,
  type LoadEarlierDmConversationMessagesResult,
  type MergeProjectionFirstWithLiveOverlayForDisplayParams,
  type MergeProjectionFirstWithLiveOverlayForDisplayResult,
  type BuildProjectionEvidenceMessagesParams,
  type ApplyRealtimeBufferedEventsParams,
} from "./thread-history/port";
