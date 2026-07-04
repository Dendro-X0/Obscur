import type { Message } from "../../types";
import type { AssembleDmHydrateThreadReadModelResult } from "./hydrate-read-model-types";
import { getMessageDirectionCounts } from "../dm-thread-read-model";
import type { RunDmConversationHydrateReadModelPipelineParams } from "./hydrate-pipeline-types";
import type { LoadEarlierDmConversationMessagesParams } from "./load-earlier-types";
import { groupThreadHistoryAdapterStub } from "./group-adapter.stub";
import {
  loadDmKernelGroupThreadEarlier,
  loadDmKernelGroupThreadPage,
} from "@/app/features/dm-kernel/dm-kernel-group-thread-port";
import {
  loadWorkspaceKernelGroupThreadEarlier,
  loadWorkspaceKernelGroupThreadPage,
} from "@/app/features/workspace-kernel/workspace-kernel-thread-port";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { resolveGroupStorageId } from "./group-thread-sqlite-store";
import type { ThreadHistoryPort } from "./port";
import { THREAD_HISTORY_DEFAULT_PAGE_SIZE } from "./contracts";

const toHydrateResult = (params: Readonly<{
  conversationId: string;
  messages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  myPublicKeyHex: string | null;
}>): AssembleDmHydrateThreadReadModelResult => ({
  finalMessages: params.messages,
  authorityDecision: { authority: "indexed", reason: "indexed_primary" },
  hasEarlier: params.hasEarlier,
  projectionFallbackHydration: false,
  authorityDiagnosticKey: "thread-history:group-sqlite",
  authorityLogContext: {
    groupStorageId: resolveGroupStorageId({ conversationId: params.conversationId }),
    messageCount: params.messages.length,
  },
  hydrationDiagnosticsLogContext: null,
  hydrated: [...params.messages],
  mappedDirectionCounts: getMessageDirectionCounts(params.messages, params.myPublicKeyHex as never),
});

const hydrateGroupThreadReadModel = async (
  params: RunDmConversationHydrateReadModelPipelineParams,
): Promise<AssembleDmHydrateThreadReadModelResult> => {
  const conversationId = params.conversationId?.trim() ?? "";
  const loadPage = isWorkspaceKernelAuthority()
    ? loadWorkspaceKernelGroupThreadPage
    : loadDmKernelGroupThreadPage;
  const page = await loadPage({
    conversationId,
    myPublicKeyHex: params.normalizedPublicKeyHex ?? params.publicKeyHex,
    pageSize: params.numeric?.liveWindowSoftLimit ?? THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  });
  return toHydrateResult({
    conversationId,
    messages: page.messages,
    hasEarlier: page.hasEarlier,
    myPublicKeyHex: params.normalizedPublicKeyHex ?? params.publicKeyHex,
  });
};

const loadEarlierGroupThreadMessages = async (
  params: LoadEarlierDmConversationMessagesParams,
): Promise<{
  messages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  didExpandHistory: boolean;
}> => {
  const loadEarlier = isWorkspaceKernelAuthority()
    ? loadWorkspaceKernelGroupThreadEarlier
    : loadDmKernelGroupThreadEarlier;
  const page = await loadEarlier({
    conversationId: params.conversationId,
    myPublicKeyHex: params.publicKeyHex,
    existingMessages: params.existingMessages,
    beforeReceivedAtMs: params.earliestTimestampMs,
    pageSize: params.loadEarlierBatchSize,
  });
  return {
    messages: page.messages,
    hasEarlier: page.hasEarlier,
    didExpandHistory: page.didExpandHistory,
  };
};

/** SQLite read adapter for group threads; write/repair plugs in via group-thread-append + relay ingest. */
export const groupThreadHistoryAdapter: ThreadHistoryPort = {
  ...groupThreadHistoryAdapterStub,
  hydrateThreadReadModel: hydrateGroupThreadReadModel,
  loadEarlierMessages: loadEarlierGroupThreadMessages,
};
