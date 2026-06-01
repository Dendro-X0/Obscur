/**
 * R1 — DM thread hydrate pipeline (orchestration owner).
 * Prepares delete tombstones, loads the IndexedDB / SQLite hydration window, merges persisted chat-state
 * fallback, runs `assembleDmHydrateThreadReadModel`, then optional sibling id-split diagnostics.
 * `use-conversation-messages` keeps React refs/state and invokes this module as the single hydrate boundary.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isSecondaryProfileWindow } from "@/app/features/runtime/services/secondary-profile-post-login-refresh-policy";
import {
  scheduleSecondaryProfileWindowRefresh,
  SECONDARY_PROFILE_DM_INCOMING_ONLY_REFRESH_DELAY_MS,
} from "@/app/features/runtime/services/secondary-profile-window-reload-scheduler";
import { runSecondaryProfileDmSoftRefresh } from "@/app/features/runtime/services/secondary-profile-dm-soft-refresh";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { AccountProjectionRuntimeSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import type { MessageDeleteTombstonesPersistencePort } from "@/app/features/profiles/types/storage-ports";
import { fromPersistedMessagesByConversationId } from "../utils/persistence";
import type { Message } from "../types";
import { chatStateStoreService } from "./chat-state-store";
import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";
import {
  assembleDmHydrateThreadReadModel,
  getMessageDirectionCounts,
  type AssembleDmHydrateThreadReadModelResult,
} from "./dm-conversation-hydrate-read-model";
import { loadInitialDmHydrationIndexedWindow } from "./dm-conversation-hydrate-indexed-scan";
import { mapIndexedConversationRowsForDisplayableScan } from "./dm-conversation-hydrate-indexed-map-rows";
import { normalizeDmConversationMessageRow } from "./dm-conversation-normalize-message";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import {
  dedupeMessagesByIdentity,
  filterMessagesByLocalRetention,
} from "./dm-conversation-message-retention-dedupe";
import { runDmHydrateSiblingIdSplitDiagnosticsIfNeeded } from "./dm-conversation-hydrate-sibling-diagnostics";
import { prepareDmThreadSuppressionIds } from "./dm-thread-suppression-prepare";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { loadNativeOutgoingCommunityInviteRepairMessages } from "./dm-conversation-native-invite-repair";
import { loadNativeOutgoingChatStateRepairMessages } from "./dm-conversation-native-outgoing-repair";

const loadPersistedConversationFallbackMessages = (params: Readonly<{
  persistedState: ReturnType<typeof chatStateStoreService.load>;
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex | null;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
}>): ReadonlyArray<Message> => {
  if (!params.persistedState) {
    return [];
  }

  const normalizedMessagesByConversationId = fromPersistedMessagesByConversationId(
    params.persistedState.messagesByConversationId ?? {},
    { myPublicKeyHex: params.myPublicKeyHex },
  );

  const merged: Message[] = [];
  params.conversationIds.forEach((conversationId) => {
    const conversationMessages = normalizedMessagesByConversationId[conversationId] ?? [];
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

export type DmConversationHydratePipelineNumericConfig = Readonly<{
  initialBatchSize: number;
  initialHydrationVisibleTarget: number;
  maxHydrationScanPasses: number;
  liveWindowSoftLimit: number;
}>;

export type RunDmConversationHydrateReadModelPipelineParams = Readonly<{
  conversationId: string;
  conversationIds: ReadonlyArray<string>;
  profileIdForTombstones: string | undefined;
  messageDeleteTombstones: MessageDeleteTombstonesPersistencePort;
  /** Mutated in place: durable + in-flight tombstone ids for this hydrate pass */
  persistedDeletedIds: Set<string>;
  publicKeyHex: PublicKeyHex | string | null;
  normalizedPublicKeyHex: PublicKeyHex | null;
  localMessageRetentionDays: number | undefined;
  numeric: DmConversationHydratePipelineNumericConfig;
  projectionMessagesSnapshot: ReadonlyArray<Message>;
  projectionEvidenceMessagesSnapshot: ReadonlyArray<Message>;
  projectionReadAuthoritySnapshot: ProjectionReadAuthority;
  accountProjectionPhase: AccountProjectionRuntimeSnapshot["phase"];
  accountProjection: AccountProjectionRuntimeSnapshot["projection"];
  accountProjectionReady: AccountProjectionRuntimeSnapshot["accountProjectionReady"];
  liveMessages: ReadonlyArray<Message>;
  expandedHistory: boolean;
  /** When set, hydrate telemetry logs only on authority key change. */
  previousAuthorityDiagnosticKey?: string | null;
  /** When true, hydrate uses sqlite/indexed authority even if projection read cutover is enabled. */
  preferIndexedAuthority?: boolean;
}>;

export async function runDmConversationHydrateReadModelPipeline(
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
    mapIndexedConversationRowsForDisplayableScan({
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

  const indexedHydration = await loadInitialDmHydrationIndexedWindow({
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
      persistedState: chatStateStoreService.load(normalizedPublicKeyHex, {
        profileId: profileIdForTombstones,
      }),
      conversationIds,
      myPublicKeyHex: normalizedPublicKeyHex,
      persistentSuppressedMessageIds: persistedDeletedIds,
      localMessageRetentionDays,
    })
    : [];

  const assembled = assembleDmHydrateThreadReadModel({
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

  const nativeInviteRepairMessages = (
    normalizedPublicKeyHex && profileIdForTombstones
  )
    ? loadNativeOutgoingCommunityInviteRepairMessages({
      conversationIds,
      myPublicKeyHex: normalizedPublicKeyHex,
      profileId: profileIdForTombstones,
    })
    : [];

  const nativeOutgoingRepairMessages = (
    normalizedPublicKeyHex
    && profileIdForTombstones
    && requiresSqlitePersistence()
  )
    ? loadNativeOutgoingChatStateRepairMessages({
      conversationIds,
      myPublicKeyHex: normalizedPublicKeyHex,
      profileId: profileIdForTombstones,
    })
    : [];

  const nativeRepairMessages = dedupeMessagesByIdentity([
    ...nativeInviteRepairMessages,
    ...nativeOutgoingRepairMessages,
  ]);

  const mergedFinalMessages = nativeRepairMessages.length > 0
    ? dedupeMessagesByIdentity([...assembled.finalMessages, ...nativeRepairMessages])
    : assembled.finalMessages;

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

  const assembledWithInviteRepair: AssembleDmHydrateThreadReadModelResult = nativeRepairMessages.length > 0
    ? {
      ...assembled,
      finalMessages: mergedFinalMessages,
    }
    : assembled;

  if (normalizedPublicKeyHex) {
    await runDmHydrateSiblingIdSplitDiagnosticsIfNeeded({
      conversationId: cid,
      normalizedPublicKeyHex,
      mappedDirectionCounts: assembled.mappedDirectionCounts,
      initialBatchSize: numeric.initialBatchSize,
      projectionReadAuthoritySnapshot,
      normalizeIndexedRowToMessage: (entry: any, siblingConversationId) => normalizeDmConversationMessageRow(entry, {
        conversationId: siblingConversationId,
        myPublicKeyHex: normalizedPublicKeyHex,
      }),
    });
  }

  logDmHydrateReadModelTelemetry({
    previousAuthorityDiagnosticKey: params.previousAuthorityDiagnosticKey ?? null,
    assembled: assembledWithInviteRepair,
  });

  return assembledWithInviteRepair;
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
