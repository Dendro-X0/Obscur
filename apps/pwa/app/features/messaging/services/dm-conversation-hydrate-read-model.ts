/**
 * Pure DM thread hydrate assembly after IndexedDB (and tombstone prep) complete.
 * R1: single read-model step for authority selection, soft cap, group scope filter,
 * durable **delete-for-me / tombstone suppression** on both cold hydrate and live-overlay merge,
 * and live-overlay merge — orchestration (tombstone prep → scan → this function → sibling diagnostics)
 * lives in **`dm-conversation-hydrate-pipeline.ts`**; `use-conversation-messages` schedules the pipeline and applies React state.
 * Sibling id-split diagnostics live in **`dm-conversation-hydrate-sibling-diagnostics.ts`**; projection evidence prep in
 * **`dm-conversation-projection-evidence-messages.ts`**; displayable line filter in
 * **`dm-conversation-displayable-message.ts`** (`isDisplayableDmConversationMessage`).
 */

import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { ProjectionReadAuthority } from "@/app/features/account-sync/services/account-projection-read-authority";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import {
  capMessageListToSoftLiveWindow,
  filterMessagesBySuppressedIds,
  mergeHydratedBaseWithLiveOverlayMessages,
} from "./conversation-message-materialization";
import {
  PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX,
  hasIndexedThinnessEvidenceForPersistedIncomingRepair,
  isPersistedCompatibilityRestorePhaseIncomingRepairCandidate,
  logDmReadHydrationDiagnostics,
  mergeIndexedWithMissingProjectionMessages,
  resolveHydrationDmReadMessages,
  type ConversationHistoryAuthorityDecision,
} from "./dm-read-authority-contract";
import { isDisplayableDmConversationMessage } from "./dm-conversation-displayable-message";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { messagingClientOperations } from "./messaging-client-operations";

type AppEventLogContext = Readonly<Record<string, string | number | boolean | null>>;

import { toConversationIdDiagnosticLabel } from "@dweb/client-gateway/messaging-diagnostics";

export { toConversationIdDiagnosticLabel };

export const getMessageDirectionCounts = (
  entries: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): Readonly<{ outgoing: number; incoming: number }> => {
  let outgoing = 0;
  let incoming = 0;
  entries.forEach((entry) => {
    const senderPubkey = normalizePublicKeyHex(entry.senderPubkey);
    const isOutgoing = entry.isOutgoing === true || (!!myPublicKeyHex && senderPubkey === myPublicKeyHex);
    if (isOutgoing) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  });
  return { outgoing, incoming };
};

export type AssembleDmHydrateThreadReadModelParams = Readonly<{
  conversationId: string;
  conversationIds: ReadonlyArray<string>;
  retentionFilteredMapped: ReadonlyArray<Message>;
  cappedHydratedMessages: ReadonlyArray<Message>;
  scannedWindowHasEarlier: boolean;
  shouldCapHydratedHistoryWindow: boolean;
  normalizedPublicKeyHex: PublicKeyHex | null;
  projectionMessagesSnapshot: ReadonlyArray<Message>;
  projectionEvidenceMessagesSnapshot: ReadonlyArray<Message>;
  projectionReadAuthoritySnapshot: ProjectionReadAuthority;
  projectionRestorePhaseActive: boolean;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  persistedStateFallbackMessages: ReadonlyArray<Message>;
  liveMessages: ReadonlyArray<Message>;
  expandedHistory: boolean;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  liveWindowSoftLimit: number;
}>;

export type AssembleDmHydrateThreadReadModelResult = Readonly<{
  finalMessages: ReadonlyArray<Message>;
  authorityDecision: ConversationHistoryAuthorityDecision;
  hasEarlier: boolean;
  projectionFallbackHydration: boolean;
  authorityDiagnosticKey: string;
  authorityLogContext: AppEventLogContext;
  hydrationDiagnosticsLogContext: AppEventLogContext | null;
  hydrated: ReadonlyArray<Message>;
  mappedDirectionCounts: Readonly<{ outgoing: number; incoming: number }>;
}>;

export const assembleDmHydrateThreadReadModel = (
  p: AssembleDmHydrateThreadReadModelParams,
): AssembleDmHydrateThreadReadModelResult => {
  const persistedFallbackDirectionCounts = getMessageDirectionCounts(
    p.persistedStateFallbackMessages,
    p.normalizedPublicKeyHex,
  );
  const indexedThinnessEvidenceForPersistedIncomingRepair = (
    hasIndexedThinnessEvidenceForPersistedIncomingRepair(p.cappedHydratedMessages.length)
  );
  const shouldUsePersistedStateFallback = (
    p.cappedHydratedMessages.length === 0
    && p.persistedStateFallbackMessages.length > 0
  );
  const mappedDirectionCounts = getMessageDirectionCounts(p.retentionFilteredMapped, p.normalizedPublicKeyHex);
  const projectionDirectionCounts = getMessageDirectionCounts(p.projectionMessagesSnapshot, p.normalizedPublicKeyHex);
  const projectionEvidenceDirectionCounts = getMessageDirectionCounts(
    p.projectionEvidenceMessagesSnapshot,
    p.normalizedPublicKeyHex,
  );
  const persistedCompatibilityRestorePhaseIncomingRepairCandidate = (
    isPersistedCompatibilityRestorePhaseIncomingRepairCandidate({
      indexedMessageCount: p.cappedHydratedMessages.length,
      indexedOutgoingCount: mappedDirectionCounts.outgoing,
      indexedIncomingCount: mappedDirectionCounts.incoming,
      persistedIncomingCount: persistedFallbackDirectionCounts.incoming,
      projectionIncomingCount: projectionEvidenceDirectionCounts.incoming,
      projectionBootstrapImportApplied: p.projectionBootstrapImportApplied,
      projectionCanonicalEvidencePending: p.projectionCanonicalEvidencePending,
      projectionRestorePhaseActive: p.projectionRestorePhaseActive,
      allowCoverageRepair: !p.projectionReadAuthoritySnapshot.useProjectionReads,
    })
  );

  const hydrationParams = {
    identityPubkey: p.normalizedPublicKeyHex,
    conversationId: p.conversationId,
    projectionMessages: p.projectionMessagesSnapshot,
    indexedMessages: p.cappedHydratedMessages,
    legacyPersistedMessages: p.persistedStateFallbackMessages,
    projectionReady: p.projectionReadAuthoritySnapshot.useProjectionReads,
    scopeVerified: true,
    useProjectionReads: p.projectionReadAuthoritySnapshot.useProjectionReads,
    legacyProjectionEvidenceMessageCount: p.projectionEvidenceMessagesSnapshot.length,
    projectionIncomingCount: projectionEvidenceDirectionCounts.incoming,
    projectionOutgoingCount: projectionEvidenceDirectionCounts.outgoing,
    projectionBootstrapImportApplied: p.projectionBootstrapImportApplied,
    projectionCanonicalEvidencePending: p.projectionCanonicalEvidencePending,
    projectionRestorePhaseActive: p.projectionRestorePhaseActive,
    indexedOutgoingCount: mappedDirectionCounts.outgoing,
    indexedIncomingCount: mappedDirectionCounts.incoming,
    persistedIncomingCount: persistedFallbackDirectionCounts.incoming,
    persistedOutgoingCount: persistedFallbackDirectionCounts.outgoing,
    suppressedMessageIds: p.persistentSuppressedMessageIds,
  };
  const {
    status: dmReadAuthorityStatus,
    messages,
    legacyAuthorityDecision,
  } = resolveHydrationDmReadMessages(hydrationParams);
  logDmReadHydrationDiagnostics(hydrationParams, dmReadAuthorityStatus);
  const authorityDecision = legacyAuthorityDecision;
  const authorityLayerMessages = (
    !p.projectionReadAuthoritySnapshot.useProjectionReads
    && p.projectionEvidenceMessagesSnapshot.length > 0
  )
    ? mergeIndexedWithMissingProjectionMessages(
      messages,
      p.projectionEvidenceMessagesSnapshot,
      p.normalizedPublicKeyHex,
    )
    : messages;
  const initialHydrated = capMessageListToSoftLiveWindow(
    authorityLayerMessages,
    p.liveWindowSoftLimit,
  );
  const scopeAllowSet = new Set(
    p.conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  const hydrated = isGroupConversationId(p.conversationId)
    ? initialHydrated.filter((m) => {
      const mid = typeof m.conversationId === "string" ? m.conversationId.trim() : "";
      return Boolean(mid) && scopeAllowSet.has(mid);
    })
    : initialHydrated;

  const hydratedSuppressed = filterMessagesBySuppressedIds(
    hydrated.filter(isDisplayableDmConversationMessage),
    p.persistentSuppressedMessageIds,
  ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const authorityDiagnosticKey = [
    p.conversationId,
    authorityDecision.authority,
    authorityDecision.reason,
    p.projectionReadAuthoritySnapshot.reason,
    p.projectionMessagesSnapshot.length,
    p.projectionEvidenceMessagesSnapshot.length,
    projectionEvidenceDirectionCounts.outgoing,
    projectionEvidenceDirectionCounts.incoming,
    p.cappedHydratedMessages.length,
    p.persistedStateFallbackMessages.length,
    projectionDirectionCounts.outgoing,
    projectionDirectionCounts.incoming,
    mappedDirectionCounts.outgoing,
    mappedDirectionCounts.incoming,
    persistedFallbackDirectionCounts.outgoing,
    persistedFallbackDirectionCounts.incoming,
    persistedCompatibilityRestorePhaseIncomingRepairCandidate,
  ].join("::");

  const authorityLogContext: AppEventLogContext = {
    conversationIdHint: toConversationIdDiagnosticLabel(p.conversationId),
    selectedAuthority: authorityDecision.authority,
    selectedAuthorityReason: authorityDecision.reason,
    selectedMessageCount: hydrated.length,
    projectionMessageCount: p.projectionMessagesSnapshot.length,
    projectionOutgoingCount: projectionDirectionCounts.outgoing,
    projectionIncomingCount: projectionDirectionCounts.incoming,
    projectionEvidenceMessageCount: p.projectionEvidenceMessagesSnapshot.length,
    projectionEvidenceOutgoingCount: projectionEvidenceDirectionCounts.outgoing,
    projectionEvidenceIncomingCount: projectionEvidenceDirectionCounts.incoming,
    projectionBootstrapImportApplied: p.projectionBootstrapImportApplied,
    projectionCanonicalEvidencePending: p.projectionCanonicalEvidencePending,
    projectionRestorePhaseActive: p.projectionRestorePhaseActive,
    indexedMessageCount: p.cappedHydratedMessages.length,
    indexedOutgoingCount: mappedDirectionCounts.outgoing,
    indexedIncomingCount: mappedDirectionCounts.incoming,
    persistedFallbackMessageCount: p.persistedStateFallbackMessages.length,
    persistedFallbackOutgoingCount: persistedFallbackDirectionCounts.outgoing,
    persistedFallbackIncomingCount: persistedFallbackDirectionCounts.incoming,
    indexedThinnessEvidenceForPersistedIncomingRepair,
    persistedCompatibilityRestorePhaseIncomingRepairCandidate,
    persistedCompatibilityRestorePhaseIncomingRepairReasonCode: "persisted_compatibility_restore_phase_missing_incoming",
    persistedIncomingRepairIndexedMessageMax: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX,
    projectionReadAuthorityReason: p.projectionReadAuthoritySnapshot.reason,
    criticalDriftCount: p.projectionReadAuthoritySnapshot.criticalDriftCount,
  };

  const hydrationDiagnosticsLogContext: AppEventLogContext | null = (
    authorityDecision.authority !== "indexed"
    || (mappedDirectionCounts.outgoing === 0 && mappedDirectionCounts.incoming > 0)
  )
    ? {
        conversationIdHint: toConversationIdDiagnosticLabel(p.conversationId),
        selectedAuthority: authorityDecision.authority,
        selectedAuthorityReason: authorityDecision.reason,
        indexedMessageCount: p.retentionFilteredMapped.length,
        indexedOutgoingCount: mappedDirectionCounts.outgoing,
        indexedIncomingCount: mappedDirectionCounts.incoming,
        persistedFallbackMessageCount: p.persistedStateFallbackMessages.length,
        persistedFallbackOutgoingCount: persistedFallbackDirectionCounts.outgoing,
        persistedFallbackIncomingCount: persistedFallbackDirectionCounts.incoming,
        indexedThinnessEvidenceForPersistedIncomingRepair,
        persistedCompatibilityRestorePhaseIncomingRepairCandidate,
        persistedCompatibilityRestorePhaseIncomingRepairReasonCode: "persisted_compatibility_restore_phase_missing_incoming",
        persistedIncomingRepairIndexedMessageMax: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX,
        shouldUsePersistedStateFallback,
        projectionMessageCount: p.projectionMessagesSnapshot.length,
        projectionOutgoingCount: projectionDirectionCounts.outgoing,
        projectionIncomingCount: projectionDirectionCounts.incoming,
        projectionEvidenceMessageCount: p.projectionEvidenceMessagesSnapshot.length,
        projectionEvidenceOutgoingCount: projectionEvidenceDirectionCounts.outgoing,
        projectionEvidenceIncomingCount: projectionEvidenceDirectionCounts.incoming,
        projectionBootstrapImportApplied: p.projectionBootstrapImportApplied,
        projectionCanonicalEvidencePending: p.projectionCanonicalEvidencePending,
        projectionRestorePhaseActive: p.projectionRestorePhaseActive,
        shouldUseProjectionFallback: authorityDecision.authority === "projection",
        projectionReadAuthorityReason: p.projectionReadAuthoritySnapshot.reason,
        criticalDriftCount: p.projectionReadAuthoritySnapshot.criticalDriftCount,
      }
    : null;

  let finalMessages: ReadonlyArray<Message> = hydratedSuppressed;
  if (p.liveMessages.length > 0) {
    const allowedConversationIds = new Set(
      p.conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
    );
    const mergedBase = mergeHydratedBaseWithLiveOverlayMessages(
      hydratedSuppressed,
      p.liveMessages,
      allowedConversationIds,
    );
    const merged = filterMessagesBySuppressedIds(
      mergedBase.filter(isDisplayableDmConversationMessage),
      p.persistentSuppressedMessageIds,
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const shouldCap = !p.expandedHistory && merged.length > p.liveWindowSoftLimit;
    finalMessages = shouldCap ? merged.slice(-p.liveWindowSoftLimit) : merged;
  }

  const hasEarlier = (authorityDecision.authority !== "indexed")
    ? false
    : ((p.scannedWindowHasEarlier || p.shouldCapHydratedHistoryWindow) && finalMessages.length > 0);

  const profileId = getResolvedProfileId() || "";
  const visibilityFiltered = profileId
    ? messagingClientOperations.filterVisibleDmMessages(finalMessages, profileId)
    : finalMessages;

  return {
    finalMessages: visibilityFiltered,
    authorityDecision,
    hasEarlier,
    projectionFallbackHydration: authorityDecision.authority !== "indexed",
    authorityDiagnosticKey,
    authorityLogContext,
    hydrationDiagnosticsLogContext,
    hydrated,
    mappedDirectionCounts,
  };
};
