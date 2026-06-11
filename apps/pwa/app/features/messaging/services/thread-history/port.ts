/**
 * Thread History Kernel port — canonical read/pagination owner for chat threads.
 * DM adapter is live; group adapter is stubbed until group-v2 backend ships.
 */
import type { Message } from "../../types";
import type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
} from "../dm-conversation-hydrate-pipeline";
import type { AssembleDmHydrateThreadReadModelResult } from "../dm-conversation-hydrate-read-model";
import type { buildProjectionEvidenceMessagesForConversation } from "../dm-conversation-projection-evidence-messages";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "../dm-conversation-projection-live-merge";
import type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "../dm-conversation-materialization-load-earlier";
import type { ApplyRealtimeBufferedEventsParams } from "../dm-conversation-materialization-realtime";
import type { PrepareDmThreadSuppressionParams } from "../dm-thread-suppression-prepare";
import type {
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "../conversation-message-materialization";

export const THREAD_HISTORY_OWNER_ID = "thread-history-kernel" as const;

/** @deprecated Prefer THREAD_HISTORY_OWNER_ID */
export const DM_CONVERSATION_MATERIALIZATION_OWNER_ID = THREAD_HISTORY_OWNER_ID;

export type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
  AssembleDmHydrateThreadReadModelResult,
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
};

export type BuildProjectionEvidenceMessagesParams = Parameters<
  typeof buildProjectionEvidenceMessagesForConversation
>[0];

/** Canonical thread history port (DM today; group plugs in via adapter). */
export type ThreadHistoryPort = Readonly<{
  prepareThreadSuppressionIds: (
    params: PrepareDmThreadSuppressionParams,
  ) => Promise<Set<string>>;
  hydrateThreadReadModel: (
    params: RunDmConversationHydrateReadModelPipelineParams,
  ) => Promise<AssembleDmHydrateThreadReadModelResult>;
  buildProjectionEvidenceMessages: (
    params: BuildProjectionEvidenceMessagesParams,
  ) => ReadonlyArray<Message>;
  mergeProjectionWithLiveOverlay: (
    params: MergeProjectionFirstWithLiveOverlayForDisplayParams,
  ) => MergeProjectionFirstWithLiveOverlayForDisplayResult;
  loadEarlierMessages: (
    params: LoadEarlierDmConversationMessagesParams,
  ) => Promise<LoadEarlierDmConversationMessagesResult>;
  applyRealtimeBufferedEvents: (
    params: ApplyRealtimeBufferedEventsParams,
  ) => ReadonlyArray<Message>;
  filterThreadMessagesBySuppression: (
    messages: ReadonlyArray<Message>,
    suppressedIds: ReadonlySet<string>,
  ) => ReturnType<typeof filterMessagesBySuppressedIds>;
  mergeHydratedBaseWithLiveOverlay: (
    baseHydrated: ReadonlyArray<Message>,
    liveOverlay: ReadonlyArray<Message>,
    overlayConversationScope: ReadonlySet<string>,
  ) => ReturnType<typeof mergeHydratedBaseWithLiveOverlayMessages>;
}>;

/** @deprecated Alias — gateway bind name retained for R1 migration */
export type DmConversationMaterializationPort = ThreadHistoryPort;

export type { ApplyRealtimeBufferedEventsParams };
