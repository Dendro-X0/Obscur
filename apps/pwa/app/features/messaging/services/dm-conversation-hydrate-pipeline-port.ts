/** Legacy cold-hydrate pipeline — loaded only via resolve-dm-thread-history-adapter when legacy opt-in. */
export {
  runLegacyDmConversationHydrateReadModelPipeline,
  logDmHydrateReadModelTelemetry,
} from "./dm-conversation-hydrate-pipeline";

export type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
} from "./thread-history/hydrate-pipeline-types";
