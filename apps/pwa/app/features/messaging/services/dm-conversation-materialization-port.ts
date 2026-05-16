/**
 * R1 — DM thread materialization port (app-owned params; wired on ClientGateway).
 */
import type { Message } from "../types";
import type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
} from "./dm-conversation-hydrate-pipeline";
import type { AssembleDmHydrateThreadReadModelResult } from "./dm-conversation-hydrate-read-model";
import type { buildProjectionEvidenceMessagesForConversation } from "./dm-conversation-projection-evidence-messages";
import type {
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
} from "./dm-conversation-projection-live-merge";
import type {
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
} from "./dm-conversation-materialization-load-earlier";
import type {
  ApplyRealtimeBufferedEventsParams,
} from "./dm-conversation-materialization-realtime";
import type { PrepareDmThreadSuppressionParams } from "./dm-thread-suppression-prepare";

export type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
  AssembleDmHydrateThreadReadModelResult,
  LoadEarlierDmConversationMessagesParams,
  LoadEarlierDmConversationMessagesResult,
  MergeProjectionFirstWithLiveOverlayForDisplayParams,
  MergeProjectionFirstWithLiveOverlayForDisplayResult,
};

export type BuildProjectionEvidenceMessagesParams = Parameters<typeof buildProjectionEvidenceMessagesForConversation>[0];

/** App-typed DM materialization port (checked against `@dweb/client-gateway` in contract-satisfaction test). */
export type DmConversationMaterializationPort = Readonly<{
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
}>;

export type { ApplyRealtimeBufferedEventsParams };
