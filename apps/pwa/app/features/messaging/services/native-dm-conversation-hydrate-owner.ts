/**
 * @deprecated Native DM must use `features/dm-kernel/`. Web legacy only.
 * @see docs/program/obscur-v2-slim-kernel-manifest.md
 *
 * R1 Pass A — native DM conversation hydrate owner.
 * Single SQLite hydrate + monotonic depth finalize + integrity diagnostics.
 * No projection supplemental, direction-coverage retry, or authority merge.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { MessageDeleteTombstonesPersistencePort } from "@/app/features/profiles/types/storage-ports";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import type { Message } from "../types";
import { dedupeMessagesByIdentity } from "./dm-conversation-message-retention-dedupe";
import {
  finalizeDmThreadHydrateRead,
  resolveExpandedHistoryAfterHydrate,
} from "./thread-history/read-model";
import { logNativeDmSqliteHydrateIntegrity } from "./native-dm-sqlite-integrity";
import { messagingClientOperations } from "./messaging-client-operations";

export const NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS = new Set<string>([
  "chat_route_active",
  "stale_empty_retry",
  "partial_direction_retry",
]);

export const shouldNativeDmSkipHydrateRetryTrigger = (trigger: string): boolean => (
  NATIVE_DM_SKIP_HYDRATE_RETRY_TRIGGERS.has(trigger)
);

export type RunNativeDmConversationHistoryHydrateParams = Readonly<{
  conversationId: string;
  conversationIds: ReadonlyArray<string>;
  profileId?: string;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  persistedDeletedIds: Set<string>;
  publicKeyHex: string | null;
  normalizedPublicKeyHex: PublicKeyHex | null;
  localMessageRetentionDays: number | undefined;
  initialBatchSize: number;
  liveWindowSoftLimit: number;
  liveMessages: ReadonlyArray<Message>;
  expandedHistory: boolean;
  hydrateStartMessages: ReadonlyArray<Message>;
  previousAuthorityDiagnosticKey: string | null;
}>;

export type RunNativeDmConversationHistoryHydrateResult = Readonly<{
  messages: ReadonlyArray<Message>;
  hasEarlier: boolean;
  authorityDiagnosticKey: string;
  expandedHistory: boolean;
}>;

export const runNativeDmConversationHistoryHydrate = async (
  params: RunNativeDmConversationHistoryHydrateParams,
): Promise<RunNativeDmConversationHistoryHydrateResult> => {
  const assembled = await messagingClientOperations.hydrateDmThreadReadModel({
    conversationId: params.conversationId,
    conversationIds: params.conversationIds,
    profileIdForTombstones: params.profileId,
    messageDeleteTombstones: params.messageDeleteTombstones,
    persistedDeletedIds: params.persistedDeletedIds,
    publicKeyHex: params.publicKeyHex,
    normalizedPublicKeyHex: params.normalizedPublicKeyHex,
    localMessageRetentionDays: params.localMessageRetentionDays,
    numeric: {
      initialBatchSize: params.initialBatchSize,
      initialHydrationVisibleTarget: params.liveWindowSoftLimit,
      maxHydrationScanPasses: 1,
      liveWindowSoftLimit: params.liveWindowSoftLimit,
    },
    projectionMessagesSnapshot: [],
    projectionEvidenceMessagesSnapshot: [],
    projectionReadAuthoritySnapshot: {
      useProjectionReads: false,
      reason: "projection_not_ready",
    } as never,
    preferIndexedAuthority: true,
    accountProjectionPhase: "idle",
    accountProjection: null,
    accountProjectionReady: true,
    liveMessages: params.liveMessages,
    expandedHistory: params.expandedHistory,
    previousAuthorityDiagnosticKey: params.previousAuthorityDiagnosticKey,
  });

  const previousMessages = dedupeMessagesByIdentity([
    ...params.hydrateStartMessages,
    ...params.liveMessages,
  ]);
  const finalizeResult = finalizeDmThreadHydrateRead({
    assembledMessages: assembled.finalMessages,
    previousMessages,
    supplementalMessages: [],
    conversationIds: params.conversationIds,
    myPublicKeyHex: params.normalizedPublicKeyHex,
    directionCoverageAttempt: 0,
    maxDirectionCoverageAttempts: 0,
  });

  if (finalizeResult.loadedDepthPreserved) {
    logAppEvent({
      name: "messaging.native_dm_hydrate_depth_preserved",
      level: "info",
      scope: { feature: "messaging", action: "native_dm_hydrate" },
      context: {
        conversationIdHint: toConversationIdDiagnosticLabel(params.conversationId),
        previousMessageCount: previousMessages.length,
        assembledMessageCount: assembled.finalMessages.length,
        preservedMessageCount: finalizeResult.messages.length,
      },
    });
  }

  const expandedHistory = resolveExpandedHistoryAfterHydrate({
    previousExpandedHistory: params.expandedHistory,
    previousMessageCount: previousMessages.length,
    hydratedMessageCount: finalizeResult.messages.length,
    liveWindowSoftLimit: params.liveWindowSoftLimit,
  });

  if (params.normalizedPublicKeyHex) {
    void logNativeDmSqliteHydrateIntegrity({
      conversationId: params.conversationId,
      myPublicKeyHex: params.normalizedPublicKeyHex,
      hydratedMessages: finalizeResult.messages,
      profileId: params.profileId,
      trigger: "conversation_hydrate",
    });
  }

  return {
    messages: finalizeResult.messages,
    hasEarlier: assembled.hasEarlier,
    authorityDiagnosticKey: assembled.authorityDiagnosticKey,
    expandedHistory,
  };
};
