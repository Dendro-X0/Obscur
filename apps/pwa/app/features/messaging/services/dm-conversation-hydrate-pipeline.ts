/**
 * DM thread hydrate pipeline (legacy web orchestration).
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isSecondaryProfileWindow } from "@/app/features/runtime/services/secondary-profile-post-login-refresh-policy";
import {
  scheduleSecondaryProfileWindowRefresh,
  SECONDARY_PROFILE_DM_INCOMING_ONLY_REFRESH_DELAY_MS,
} from "@/app/features/runtime/services/secondary-profile-window-reload-scheduler";
import { runSecondaryProfileDmSoftRefresh } from "@/app/features/runtime/services/secondary-profile-dm-soft-refresh";
import { logAppEvent } from "@/app/shared/log-app-event";
import { fromPersistedMessagesByConversationId } from "@/app/features/messaging/utils/persistence";
import type { Message } from "@/app/features/messaging/types";
import { messagingChatStateReadPort } from "@/app/features/messaging/services/messaging-chat-state-read-port";
import {
  assembleLegacyDmHydrateThreadReadModel,
  type AssembleDmHydrateThreadReadModelResult,
} from "@/app/features/messaging/services/thread-history/hydrate-read-model";
import {
  loadLegacyInitialDmHydrationIndexedWindow,
  mapLegacyIndexedConversationRowsForDisplayableScan,
} from "@/app/features/messaging/services/thread-history/hydrate-indexed-legacy-port";
import { normalizeDmConversationMessageRow } from "@/app/features/messaging/services/dm-conversation-normalize-message";
import { isDisplayableDmConversationMessage } from "@/app/features/messaging/services/dm-conversation-displayable-message";
import { isMessageIdentityInSuppressedIdSet } from "@/app/features/messaging/services/conversation-message-visibility";
import {
  dedupeMessagesByIdentity,
  filterMessagesByLocalRetention,
} from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";
import { prepareDmThreadSuppressionIds } from "@/app/features/messaging/services/dm-thread-suppression-prepare";
import { getMessageDirectionCounts, mergeDirectionGapFromSupplemental } from "@/app/features/messaging/services/dm-thread-read-model";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type {
  RunDmConversationHydrateReadModelPipelineParams,
} from "@/app/features/messaging/services/thread-history/hydrate-pipeline-types";

export type {
  DmConversationHydratePipelineNumericConfig,
  RunDmConversationHydrateReadModelPipelineParams,
} from "@/app/features/messaging/services/thread-history/hydrate-pipeline-types";

const loadPersistedConversationFallbackMessages = (params: Readonly<{
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
  conversationIds: ReadonlyArray<string>;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
}>): ReadonlyArray<Message> => {
  const profileIds = listAccountSharedSqliteProfileIds({
    primaryProfileId: params.profileId?.trim() || getResolvedProfileId(),
    accountPublicKeyHex: params.myPublicKeyHex,
  });

  const mergedMessagesByConversationId: Record<string, ReadonlyArray<Message>> = {};
  profileIds.forEach((profileId) => {
    const persistedState = messagingChatStateReadPort.load(params.myPublicKeyHex, { profileId });
    if (!persistedState?.messagesByConversationId) {
      return;
    }
    const normalized = fromPersistedMessagesByConversationId(
      persistedState.messagesByConversationId,
      { myPublicKeyHex: params.myPublicKeyHex },
    );
    Object.entries(normalized).forEach(([conversationId, messages]) => {
      const existing = mergedMessagesByConversationId[conversationId] ?? [];
      mergedMessagesByConversationId[conversationId] = [...existing, ...messages];
    });
  });

  if (Object.keys(mergedMessagesByConversationId).length === 0) {
    return [];
  }

  const merged: Message[] = [];
  params.conversationIds.forEach((conversationId) => {
    const conversationMessages = mergedMessagesByConversationId[conversationId] ?? [];
    merged.push(...conversationMessages);
  });

  return filterMessagesByLocalRetention(
    dedupeMessagesByIdentity(merged),
    params.localMessageRetentionDays,
  ).filter((message) => (
    isDisplayableDmConversationMessage(message)
    && !isMessageIdentityInSuppressedIdSet(message, params.persistentSuppressedMessageIds)
  ));
};

export async function runLegacyDmConversationHydrateReadModelPipeline(
  params: RunDmConversationHydrateReadModelPipelineParams,
): Promise<AssembleDmHydrateThreadReadModelResult> {
  const {
    conversationId: cid,
    conversationIds,
    profileIdForTombstones,
    messageDeleteTombstones,
    persistedDeletedIds,
    publicKeyHex,
    normalizedPublicKeyHex,
    localMessageRetentionDays,
    numeric,
    projectionMessagesSnapshot,
    projectionEvidenceMessagesSnapshot,
    projectionReadAuthoritySnapshot: projectionReadAuthorityInput,
    accountProjectionPhase,
    accountProjection,
    accountProjectionReady,
    liveMessages,
    expandedHistory,
    preferIndexedAuthority = false,
  } = params;

  const projectionReadAuthoritySnapshot = preferIndexedAuthority
    ? {
      ...projectionReadAuthorityInput,
      useProjectionReads: false,
      reason: "projection_not_ready" as const,
    }
    : projectionReadAuthorityInput;

  const preparedSuppressionIds = await prepareDmThreadSuppressionIds({
    profileId: profileIdForTombstones,
    accountPublicKeyHex: normalizedPublicKeyHex,
    projection: accountProjection,
    messageDeleteTombstones,
    seedIds: persistedDeletedIds,
  });
  persistedDeletedIds.clear();
  preparedSuppressionIds.forEach((id) => persistedDeletedIds.add(id));

  const mapRowsToDisplayableMessages = (rows: ReadonlyArray<any>): ReadonlyArray<Message> => (
    mapLegacyIndexedConversationRowsForDisplayableScan({
      pipeline: "initial_hydrate",
      rows,
      normalizeRow: (m: any) => normalizeDmConversationMessageRow(m, {
        conversationId: typeof m?.conversationId === "string" ? m.conversationId : cid,
        myPublicKeyHex: publicKeyHex,
      }),
      persistentSuppressedMessageIds: persistedDeletedIds,
      isDisplayable: isDisplayableDmConversationMessage,
      localMessageRetentionDays,
    })
  );

  const indexedHydration = await loadLegacyInitialDmHydrationIndexedWindow({
    conversationIds,
    initialBatchSize: numeric.initialBatchSize,
    mapRows: mapRowsToDisplayableMessages,
    targetVisibleCount: numeric.initialHydrationVisibleTarget,
    maxPassCount: numeric.maxHydrationScanPasses,
    liveWindowSoftLimit: numeric.liveWindowSoftLimit,
    accountPublicKeyHex: normalizedPublicKeyHex,
  });

  const projectionRestorePhaseActive = (
    accountProjectionPhase === "bootstrapping"
    || accountProjectionPhase === "replaying_event_log"
  );
  const projectionBootstrapImportApplied = accountProjection?.sync?.bootstrapImportApplied === true;
  const projectionCanonicalEvidencePending = (
    accountProjectionReady !== true
    || projectionRestorePhaseActive
  );

  const persistedStateFallbackMessages = (
    normalizedPublicKeyHex && !requiresSqlitePersistence()
  )
    ? loadPersistedConversationFallbackMessages({
      myPublicKeyHex: normalizedPublicKeyHex,
      profileId: profileIdForTombstones,
      conversationIds,
      persistentSuppressedMessageIds: persistedDeletedIds,
      localMessageRetentionDays,
    })
    : [];

  const assembled = assembleLegacyDmHydrateThreadReadModel({
    conversationId: cid,
    conversationIds,
    retentionFilteredMapped: indexedHydration.retentionFilteredMapped,
    cappedHydratedMessages: indexedHydration.cappedHydratedMessages,
    scannedWindowHasEarlier: indexedHydration.hasEarlier,
    shouldCapHydratedHistoryWindow: indexedHydration.shouldCapHydratedHistoryWindow,
    normalizedPublicKeyHex,
    projectionMessagesSnapshot,
    projectionEvidenceMessagesSnapshot,
    projectionReadAuthoritySnapshot,
    projectionRestorePhaseActive,
    projectionBootstrapImportApplied,
    projectionCanonicalEvidencePending,
    persistedStateFallbackMessages,
    liveMessages,
    expandedHistory,
    persistentSuppressedMessageIds: persistedDeletedIds,
    liveWindowSoftLimit: numeric.liveWindowSoftLimit,
  });

  const mergedFinalMessages = mergeDirectionGapFromSupplemental({
    baseMessages: assembled.finalMessages,
    supplementalMessages: persistedStateFallbackMessages,
    conversationIds,
    myPublicKeyHex: normalizedPublicKeyHex,
  });

  const mergedDirectionCounts = getMessageDirectionCounts(
    mergedFinalMessages,
    normalizedPublicKeyHex,
  );

  if (
    requiresSqlitePersistence()
    && normalizedPublicKeyHex
    && profileIdForTombstones
    && mergedDirectionCounts.incoming > 0
    && mergedDirectionCounts.outgoing === 0
    && isSecondaryProfileWindow(profileIdForTombstones)
  ) {
    const scheduledRefresh = scheduleSecondaryProfileWindowRefresh({
      reason: "dm_incoming_only",
      profileId: profileIdForTombstones,
      delayMs: SECONDARY_PROFILE_DM_INCOMING_ONLY_REFRESH_DELAY_MS,
      onRefresh: (): void => {
        runSecondaryProfileDmSoftRefresh({
          profileId: profileIdForTombstones,
          myPublicKeyHex: normalizedPublicKeyHex,
          reason: "dm_incoming_only",
        });
      },
    });
    if (scheduledRefresh) {
      logAppEvent({
        name: "runtime.secondary_profile_dm_incoming_only_refresh_scheduled",
        level: "info",
        scope: { feature: "messaging", action: "conversation_hydrate" },
        context: {
          profileId: profileIdForTombstones,
          conversationIdHint: cid,
          incomingCount: mergedDirectionCounts.incoming,
        },
      });
    }
  }

  const assembledResult: AssembleDmHydrateThreadReadModelResult = {
    ...assembled,
    finalMessages: mergedFinalMessages,
  };

  logDmHydrateReadModelTelemetry({
    previousAuthorityDiagnosticKey: params.previousAuthorityDiagnosticKey ?? null,
    assembled: assembledResult,
  });

  return assembledResult;
}

export function logDmHydrateReadModelTelemetry(params: Readonly<{
  previousAuthorityDiagnosticKey: string | null;
  assembled: AssembleDmHydrateThreadReadModelResult;
}>): string {
  const { assembled, previousAuthorityDiagnosticKey } = params;
  if (previousAuthorityDiagnosticKey !== assembled.authorityDiagnosticKey) {
    logAppEvent({
      name: "messaging.conversation_history_authority_selected",
      level: assembled.authorityDecision.authority === "persisted" ? "warn" : "info",
      scope: { feature: "messaging", action: "conversation_history_authority" },
      context: assembled.authorityLogContext,
    });
  }
  if (assembled.hydrationDiagnosticsLogContext) {
    logAppEvent({
      name: "messaging.conversation_hydration_diagnostics",
      level: assembled.authorityDecision.authority === "indexed" ? "warn" : "info",
      scope: { feature: "messaging", action: "conversation_hydrate" },
      context: assembled.hydrationDiagnosticsLogContext,
    });
  }
  return assembled.authorityDiagnosticKey;
}
