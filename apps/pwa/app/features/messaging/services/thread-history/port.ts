/**
 * Thread History Kernel port — canonical read/pagination owner for chat threads.
 * DM adapter is live; group adapter is stubbed until group-v2 backend ships.
 */
import type { Message } from "../../types";
import type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
} from "./hydrate-pipeline-types";
import type { AssembleDmHydrateThreadReadModelResult } from "./hydrate-read-model-types";
import type { BuildProjectionEvidenceMessagesParams } from "./projection-evidence-types";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./projection-live-merge-types";
import type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "./load-earlier-types";
import type { ApplyRealtimeBufferedEventsParams } from "./realtime-materialization-types";
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
} from "./hydrate-pipeline-types";

export type {
  ConversationHistoryAuthority,
  ConversationHistoryAuthorityReason,
  ConversationHistoryAuthorityDecision,
  ResolveConversationHistoryAuthorityParams,
} from "./hydrate-authority-types";

export type { AssembleDmHydrateThreadReadModelResult } from "./hydrate-read-model-types";

export type { BuildProjectionEvidenceMessagesParams } from "./projection-evidence-types";

export type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./projection-live-merge-types";

export type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "./load-earlier-types";

export type { ApplyRealtimeBufferedEventsParams } from "./realtime-materialization-types";

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
