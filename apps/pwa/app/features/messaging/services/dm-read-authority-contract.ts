/**
 * DM read authority for legacy web hydrate — native uses dm-kernel SQLite reads.
 */

import type { Message } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  filterMessagesBySuppressedIds,
  selectMessagesForConversationHistoryAuthority,
} from "@/app/features/messaging/services/conversation-message-materialization";
import { persistedMessagesContainSuppressedIdentities } from "@/app/features/messaging/services/dm-thread-suppression-set";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isNativeDmSqliteReadOwner } from "@/app/features/messaging/services/native-dm-read-policy";
import { dedupeMessagesByIdentity } from "@/app/features/messaging/services/dm-conversation-message-retention-dedupe";
import { collectMessageIdentityAliases } from "@/app/features/messaging/services/message-identity-alias-contract";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { getMessageDirectionCounts } from "@/app/features/messaging/services/dm-thread-read-model";
import type {
  ConversationHistoryAuthorityDecision,
  ResolveConversationHistoryAuthorityParams,
} from "@/app/features/messaging/services/thread-history/hydrate-authority-types";

export type {
  ConversationHistoryAuthority,
  ConversationHistoryAuthorityReason,
  ConversationHistoryAuthorityDecision,
  ResolveConversationHistoryAuthorityParams,
} from "@/app/features/messaging/services/thread-history/hydrate-authority-types";

export const PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX = 3;

export const hasIndexedThinnessEvidenceForPersistedIncomingRepair = (
  indexedMessageCount: number,
): boolean => (
  Number.isFinite(indexedMessageCount)
  && indexedMessageCount > 0
  && indexedMessageCount <= PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX
);

export type PersistedCompatibilityRestorePhaseIncomingRepairCandidateParams = Readonly<{
  indexedMessageCount: number;
  indexedOutgoingCount: number;
  indexedIncomingCount: number;
  persistedIncomingCount: number;
  projectionIncomingCount: number;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  projectionRestorePhaseActive: boolean;
  allowCoverageRepair: boolean;
}>;

export const isPersistedCompatibilityRestorePhaseIncomingRepairCandidate = (
  params: PersistedCompatibilityRestorePhaseIncomingRepairCandidateParams,
): boolean => (
  params.allowCoverageRepair
  && params.indexedOutgoingCount > 0
  && params.indexedIncomingCount === 0
  && params.persistedIncomingCount > 0
  && params.projectionIncomingCount === 0
  && params.projectionBootstrapImportApplied === false
  && params.projectionCanonicalEvidencePending === true
  && params.projectionRestorePhaseActive === true
  && hasIndexedThinnessEvidenceForPersistedIncomingRepair(params.indexedMessageCount)
);

export type DmReadAuthoritySource = "projection" | "indexed_recovery" | "legacy_persisted" | "none";

export type DmReadAuthorityReason =
  | "projection_ready"
  | "projection_empty_recovery_from_indexed"
  | "projection_empty_recovery_from_legacy"
  | "projection_drift_fallback_blocked"
  | "all_sources_empty"
  | "no_identity"
  | "no_conversation_id";

export type DmReadAuthorityStatus = Readonly<{
  source: DmReadAuthoritySource;
  reason: DmReadAuthorityReason;
  isCanonical: boolean;
  diagnostics: Readonly<{
    projectionMessageCount: number;
    indexedMessageCount: number;
    legacyPersistedCount: number;
    scopeVerified: boolean;
  }>;
}>;

export type DmReadAuthorityParams = Readonly<{
  identityPubkey: PublicKeyHex | null;
  conversationId: string | null;
  projectionMessages: ReadonlyArray<Message>;
  indexedMessages: ReadonlyArray<Message>;
  legacyPersistedMessages: ReadonlyArray<Message>;
  projectionReady: boolean;
  scopeVerified: boolean;
  allowIndexedRecovery: boolean;
  allowLegacyRecovery: boolean;
}>;

/**
 * Resolves the single canonical DM read authority.
 *
 * Rules:
 * 1. If projection is ready and has messages, use projection (canonical).
 * 2. If projection is ready but empty, allow indexed recovery (diagnostics).
 * 3. If indexed is empty, allow legacy persisted recovery (diagnostics, deprecated).
 * 4. If projection has drift/critical issues, block reads and emit diagnostics.
 * 5. Never silently mix sources without explicit authority decision.
 */
export const resolveDmReadAuthority = (params: DmReadAuthorityParams): DmReadAuthorityStatus => {
  const projectionMessageCount = params.projectionMessages.length;
  const indexedMessageCount = params.indexedMessages.length;
  const legacyPersistedCount = params.legacyPersistedMessages.length;

  const diagnostics = {
    projectionMessageCount,
    indexedMessageCount,
    legacyPersistedCount,
    scopeVerified: params.scopeVerified,
  };

  // Identity check
  if (!params.identityPubkey) {
    return {
      source: "none",
      reason: "no_identity",
      isCanonical: false,
      diagnostics,
    };
  }

  // Conversation ID check
  if (!params.conversationId) {
    return {
      source: "none",
      reason: "no_conversation_id",
      isCanonical: false,
      diagnostics,
    };
  }

  // Scope verification check
  if (!params.scopeVerified) {
    return {
      source: "none",
      reason: "projection_drift_fallback_blocked",
      isCanonical: false,
      diagnostics,
    };
  }

  // Canonical path: projection ready with messages
  if (params.projectionReady && projectionMessageCount > 0) {
    return {
      source: "projection",
      reason: "projection_ready",
      isCanonical: true,
      diagnostics,
    };
  }

  // Recovery path 1: indexed messages (explicit opt-in only)
  if (params.allowIndexedRecovery && indexedMessageCount > 0) {
    return {
      source: "indexed_recovery",
      reason: "projection_empty_recovery_from_indexed",
      isCanonical: false,
      diagnostics,
    };
  }

  // Recovery path 2: legacy persisted (explicit opt-in only, deprecated)
  if (params.allowLegacyRecovery && legacyPersistedCount > 0) {
    return {
      source: "legacy_persisted",
      reason: "projection_empty_recovery_from_legacy",
      isCanonical: false,
      diagnostics,
    };
  }

  // Last-resort recovery when projection is ready but this thread has no projection rows yet.
  if (indexedMessageCount > 0) {
    return {
      source: "indexed_recovery",
      reason: "projection_empty_recovery_from_indexed",
      isCanonical: false,
      diagnostics,
    };
  }

  if (legacyPersistedCount > 0) {
    return {
      source: "legacy_persisted",
      reason: "projection_empty_recovery_from_legacy",
      isCanonical: false,
      diagnostics,
    };
  }

  return {
    source: "none",
    reason: "all_sources_empty",
    isCanonical: false,
    diagnostics,
  };
};

/**
 * Selects messages based on resolved authority.
 * Never mixes sources - returns exactly one source's messages.
 */
export const selectMessagesByAuthority = (
  params: DmReadAuthorityParams,
): ReadonlyArray<Message> => {
  const authority = resolveDmReadAuthority(params);

  switch (authority.source) {
    case "projection":
      return params.projectionMessages;
    case "indexed_recovery":
      return params.indexedMessages;
    case "legacy_persisted":
      return params.legacyPersistedMessages;
    case "none":
    default:
      return [];
  }
};

/**
 * Checks if the current authority is the canonical projection path.
 * Use this to emit warnings when non-canonical paths are active.
 */
export const isCanonicalDmReadPath = (status: DmReadAuthorityStatus): boolean => (
  status.isCanonical && status.source === "projection"
);

/**
 * Formats authority status for diagnostics logging.
 */
export const formatDmReadAuthorityForDiagnostics = (
  status: DmReadAuthorityStatus,
): string => {
  const canonicalTag = status.isCanonical ? "[CANONICAL]" : "[NON-CANONICAL]";
  const d = status.diagnostics;
  return (
    `${canonicalTag} DM Read Authority: source=${status.source}, ` +
    `reason=${status.reason}, ` +
    `projection=${d.projectionMessageCount}, ` +
    `indexed=${d.indexedMessageCount}, ` +
    `legacy=${d.legacyPersistedCount}, ` +
    `scope=${d.scopeVerified}`
  );
};

/**
 * Count-based legacy authority (projection read cutover + thin-index persisted repair).
 * Quarantined `conversation-history-authority.ts` was removed (2026-05-14); types + repair gates live in this module.
 */
/** Projection is missing a direction that bidirectional sqlite already materialized (boot lag), not outgoing-only local sqlite. */
export const isProjectionHydrationDirectionIncomplete = (
  params: Readonly<{
    projectionOutgoingCount: number;
    projectionIncomingCount: number;
    indexedOutgoingCount: number;
    indexedIncomingCount: number;
  }>,
): boolean => {
  const indexedHasBidirectionalCoverage = (
    params.indexedOutgoingCount > 0 && params.indexedIncomingCount > 0
  );
  if (!indexedHasBidirectionalCoverage) {
    return false;
  }
  return (
    (params.projectionOutgoingCount === 0 && params.indexedOutgoingCount > 0)
    || (params.projectionIncomingCount === 0 && params.indexedIncomingCount > 0)
  );
};

/** Desktop sqlite may have a direction the projection timeline has not caught up on yet. */
export const isNativeProjectionMissingIndexedDirection = (
  params: Readonly<{
    projectionOutgoingCount: number;
    projectionIncomingCount: number;
    indexedOutgoingCount: number;
    indexedIncomingCount: number;
  }>,
): boolean => {
  if (!requiresSqlitePersistence()) {
    return false;
  }
  return (
    (params.projectionOutgoingCount === 0 && params.indexedOutgoingCount > 0)
    || (params.projectionIncomingCount === 0 && params.indexedIncomingCount > 0)
  );
};

/** Secondary windows often bootstrap projection with relay-sourced incoming rows only. */
export const isNativeProjectionIncomingOnly = (
  params: Readonly<{
    projectionOutgoingCount: number;
    projectionIncomingCount: number;
    projectionMessageCount: number;
  }>,
): boolean => (
  requiresSqlitePersistence()
  && params.projectionMessageCount > 0
  && params.projectionOutgoingCount === 0
  && params.projectionIncomingCount > 0
);

const shouldPreferIndexedOverProjectionReads = (
  params: ResolveConversationHistoryAuthorityParams,
): boolean => (
  isProjectionHydrationDirectionIncomplete(params)
  || isNativeProjectionMissingIndexedDirection(params)
  || isNativeProjectionIncomingOnly(params)
);

export const resolveLegacyHydrationAuthority = (
  params: ResolveConversationHistoryAuthorityParams,
): ConversationHistoryAuthorityDecision => {
  if (isNativeDmSqliteReadOwner()) {
    return {
      authority: "indexed",
      reason: "indexed_primary",
    };
  }

  if (params.useProjectionReads && params.projectionMessageCount > 0) {
    if (shouldPreferIndexedOverProjectionReads(params)) {
      return {
        authority: "indexed",
        reason: "indexed_primary_projection_direction_incomplete",
      };
    }
    return {
      authority: "projection",
      reason: "projection_read_cutover",
    };
  }

  const persistedIncomingMissingFromThinIndexedRestoreWindow = (
    params.blockPersistedRestoreRepair !== true
    && params.projectionCanonicalEvidencePending === true
    && params.projectionRestorePhaseActive === true
    && hasIndexedThinnessEvidenceForPersistedIncomingRepair(params.indexedMessageCount)
    && params.indexedOutgoingCount > 0
    && params.indexedIncomingCount === 0
    && params.persistedIncomingCount > params.indexedIncomingCount
  );
  if (persistedIncomingMissingFromThinIndexedRestoreWindow) {
    return {
      authority: "persisted",
      reason: "persisted_recovery_indexed_missing_incoming",
    };
  }

  const persistedOutgoingMissingFromThinIndexedRestoreWindow = (
    params.blockPersistedRestoreRepair !== true
    && params.projectionCanonicalEvidencePending === true
    && params.projectionRestorePhaseActive === true
    && hasIndexedThinnessEvidenceForPersistedIncomingRepair(params.indexedMessageCount)
    && params.indexedIncomingCount > 0
    && params.indexedOutgoingCount === 0
    && params.persistedOutgoingCount > params.indexedOutgoingCount
  );
  if (persistedOutgoingMissingFromThinIndexedRestoreWindow) {
    return {
      authority: "persisted",
      reason: "persisted_recovery_indexed_missing_outgoing",
    };
  }

  if (
    params.blockPersistedRestoreRepair !== true
    && params.persistedMessageCount > 0
    && params.indexedMessageCount === 0
  ) {
    return {
      authority: "persisted",
      reason: "persisted_recovery_indexed_empty",
    };
  }

  return {
    authority: "indexed",
    reason: "indexed_primary",
  };
};

export type DmHydrationMigrationParams = Readonly<{
  identityPubkey: PublicKeyHex | null;
  conversationId: string | null;
  projectionMessages: ReadonlyArray<Message>;
  indexedMessages: ReadonlyArray<Message>;
  legacyPersistedMessages: ReadonlyArray<Message>;
  projectionReady: boolean;
  scopeVerified: boolean;
  useProjectionReads: boolean;
  /**
   * Legacy authority uses **evidence** projection message count (pre-filter timeline), not
   * `projectionMessages.length`. Pass when they differ.
   */
  legacyProjectionEvidenceMessageCount?: number;
  projectionIncomingCount: number;
  projectionOutgoingCount: number;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  projectionRestorePhaseActive: boolean;
  indexedOutgoingCount: number;
  indexedIncomingCount: number;
  persistedIncomingCount: number;
  persistedOutgoingCount: number;
  /** Durable delete-for-me / tombstone ids applied at authority selection (defense in depth). */
  suppressedMessageIds?: ReadonlySet<string>;
}>;

/** @deprecated Prefer {@link DmHydrationMigrationParams} */
export type MigrationBridgeParams = DmHydrationMigrationParams;

const buildLegacyResolveParams = (
  params: DmHydrationMigrationParams,
): ResolveConversationHistoryAuthorityParams => {
  const projectionMessageCountForLegacy = (
    typeof params.legacyProjectionEvidenceMessageCount === "number"
      ? params.legacyProjectionEvidenceMessageCount
      : params.projectionMessages.length
  );
  const suppressedIds = params.suppressedMessageIds ?? new Set<string>();
  const blockPersistedRestoreRepair = (
    requiresSqlitePersistence()
    || (
      params.projectionRestorePhaseActive === true
      && suppressedIds.size > 0
      && persistedMessagesContainSuppressedIdentities(params.legacyPersistedMessages, suppressedIds)
    )
  );
  return {
    useProjectionReads: params.useProjectionReads,
    projectionMessageCount: projectionMessageCountForLegacy,
    projectionIncomingCount: params.projectionIncomingCount,
    projectionOutgoingCount: params.projectionOutgoingCount,
    projectionBootstrapImportApplied: params.projectionBootstrapImportApplied,
    projectionCanonicalEvidencePending: params.projectionCanonicalEvidencePending,
    projectionRestorePhaseActive: params.projectionRestorePhaseActive,
    indexedMessageCount: params.indexedMessages.length,
    indexedOutgoingCount: params.indexedOutgoingCount,
    indexedIncomingCount: params.indexedIncomingCount,
    persistedMessageCount: params.legacyPersistedMessages.length,
    persistedOutgoingCount: params.persistedOutgoingCount,
    persistedIncomingCount: params.persistedIncomingCount,
    blockPersistedRestoreRepair,
  };
};

const applyHydrationSuppressionFilter = (
  messages: ReadonlyArray<Message>,
  suppressedIds: ReadonlySet<string>,
): ReadonlyArray<Message> => (
  suppressedIds.size === 0
    ? messages
    : filterMessagesBySuppressedIds(messages, suppressedIds)
);

/** When sqlite is authoritative but projection has newer rows (e.g. outgoing invites), union gaps. */
export const mergeIndexedWithMissingProjectionMessages = (
  indexedMessages: ReadonlyArray<Message>,
  projectionMessages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null = null,
): ReadonlyArray<Message> => {
  if (projectionMessages.length === 0) {
    return indexedMessages;
  }
  const indexedIdentityIds = new Set<string>();
  indexedMessages.forEach((message) => {
    collectMessageIdentityAliases(message).forEach((identityId) => {
      indexedIdentityIds.add(identityId);
    });
  });
  const isStructuredCommunityControlPayload = (message: Message): boolean => {
    try {
      const parsed = JSON.parse(message.content) as { type?: unknown };
      return parsed?.type === "community-invite" || parsed?.type === "community-invite-response";
    } catch {
      return false;
    }
  };
  const indexedCounts = getMessageDirectionCounts(indexedMessages, myPublicKeyHex);
  const projectionCounts = getMessageDirectionCounts(projectionMessages, myPublicKeyHex);
  const missingOutgoingInIndexed = indexedCounts.outgoing === 0 && projectionCounts.outgoing > 0;
  const missingIncomingInIndexed = indexedCounts.incoming === 0 && projectionCounts.incoming > 0;
  const projectionOnly = projectionMessages.filter((message) => {
    if (collectMessageIdentityAliases(message).some((identityId) => indexedIdentityIds.has(identityId))) {
      return false;
    }
    if (isStructuredCommunityControlPayload(message)) {
      return true;
    }
    const senderPubkey = normalizePublicKeyHex(message.senderPubkey);
    const isOutgoing = message.isOutgoing === true
      || (!!myPublicKeyHex && senderPubkey === myPublicKeyHex);
    if (missingOutgoingInIndexed && isOutgoing) {
      return true;
    }
    if (missingIncomingInIndexed && !isOutgoing) {
      return true;
    }
    return false;
  });
  if (projectionOnly.length === 0) {
    return indexedMessages;
  }
  return [...dedupeMessagesByIdentity([...indexedMessages, ...projectionOnly])].sort(
    (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
  );
};

const mapLegacyDecisionToDmReadStatus = (
  legacy: ConversationHistoryAuthorityDecision,
  params: DmHydrationMigrationParams,
): DmReadAuthorityStatus => {
  const diagnostics = {
    projectionMessageCount: params.projectionMessages.length,
    indexedMessageCount: params.indexedMessages.length,
    legacyPersistedCount: params.legacyPersistedMessages.length,
    scopeVerified: params.scopeVerified,
  };
  if (legacy.authority === "projection") {
    return {
      source: "projection",
      reason: "projection_ready",
      isCanonical: true,
      diagnostics,
    };
  }
  if (legacy.authority === "persisted") {
    return {
      source: "legacy_persisted",
      reason: "projection_empty_recovery_from_legacy",
      isCanonical: false,
      diagnostics,
    };
  }
  return {
    source: "indexed_recovery",
    reason: "projection_empty_recovery_from_indexed",
    isCanonical: false,
    diagnostics,
  };
};

const buildDmReadAuthorityParamsFromLegacyDecision = (
  params: DmHydrationMigrationParams,
  legacyAuthority: ConversationHistoryAuthorityDecision,
): DmReadAuthorityParams => {
  const nativeSqliteOnly = requiresSqlitePersistence();
  const allowIndexedRecovery = nativeSqliteOnly
    ? legacyAuthority.authority === "indexed"
    : (
      legacyAuthority.authority === "indexed"
      || legacyAuthority.reason === "persisted_recovery_indexed_missing_incoming"
      || legacyAuthority.reason === "persisted_recovery_indexed_missing_outgoing"
    );
  const allowLegacyRecovery = !nativeSqliteOnly && legacyAuthority.authority === "persisted";
  return {
    identityPubkey: params.identityPubkey,
    conversationId: params.conversationId,
    projectionMessages: params.projectionMessages,
    indexedMessages: params.indexedMessages,
    legacyPersistedMessages: params.legacyPersistedMessages,
    projectionReady: params.projectionReady,
    scopeVerified: params.scopeVerified,
    allowIndexedRecovery,
    allowLegacyRecovery,
  };
};

/**
 * DM hydrate: one legacy gate pass → {@link resolveDmReadAuthority} → single-layer messages.
 * When `identityPubkey` is null, uses legacy materialization. **`legacyAuthorityDecision`** is always
 * returned for granular `conversation_history_authority` logs.
 */
export const resolveHydrationDmReadMessages = (
  params: DmHydrationMigrationParams,
): Readonly<{
  status: DmReadAuthorityStatus;
  messages: ReadonlyArray<Message>;
  /** Always set: granular legacy reason for `conversation_history_authority` logs. */
  legacyAuthorityDecision: ConversationHistoryAuthorityDecision;
}> => {
  const suppressedIds = params.suppressedMessageIds ?? new Set<string>();
  const legacyDecision = resolveLegacyHydrationAuthority(buildLegacyResolveParams(params));

  if (isNativeDmSqliteReadOwner()) {
    const status = mapLegacyDecisionToDmReadStatus(legacyDecision, params);
    return {
      status,
      messages: applyHydrationSuppressionFilter(params.indexedMessages, suppressedIds),
      legacyAuthorityDecision: legacyDecision,
    };
  }

  if (!params.identityPubkey) {
    const rawMessages = selectMessagesForConversationHistoryAuthority(legacyDecision, {
      projection: params.projectionMessages,
      persisted: params.legacyPersistedMessages,
      indexed: params.indexedMessages,
    });
    const status = mapLegacyDecisionToDmReadStatus(legacyDecision, params);
    return {
      status,
      messages: applyHydrationSuppressionFilter(rawMessages, suppressedIds),
      legacyAuthorityDecision: legacyDecision,
    };
  }

  if (
    legacyDecision.authority === "persisted"
    && params.legacyPersistedMessages.length > 0
    && !requiresSqlitePersistence()
  ) {
    const status = mapLegacyDecisionToDmReadStatus(legacyDecision, params);
    return {
      status,
      messages: applyHydrationSuppressionFilter(params.legacyPersistedMessages, suppressedIds),
      legacyAuthorityDecision: legacyDecision,
    };
  }

  if (legacyDecision.reason === "indexed_primary_projection_direction_incomplete") {
    const status = mapLegacyDecisionToDmReadStatus(legacyDecision, params);
    return {
      status,
      messages: applyHydrationSuppressionFilter(
        mergeIndexedWithMissingProjectionMessages(
          params.indexedMessages,
          params.projectionMessages,
          params.identityPubkey,
        ),
        suppressedIds,
      ),
      legacyAuthorityDecision: legacyDecision,
    };
  }

  const selectionParams = buildDmReadAuthorityParamsFromLegacyDecision(params, legacyDecision);
  const status = resolveDmReadAuthority(selectionParams);
  return {
    status,
    messages: applyHydrationSuppressionFilter(
      selectMessagesByAuthority(selectionParams),
      suppressedIds,
    ),
    legacyAuthorityDecision: legacyDecision,
  };
};

let dmReadHydrationDiagCount = 0;
const DM_READ_HYDRATION_DIAG_THRESHOLD = 10;

/** Test-only reset for {@link logDmReadHydrationDiagnostics} counter. */
export const resetDmReadHydrationDiagnosticsForTests = (): void => {
  dmReadHydrationDiagCount = 0;
};

export const getDmReadHydrationDiagnosticsStats = (): { usageCount: number; threshold: number } => ({
  usageCount: dmReadHydrationDiagCount,
  threshold: DM_READ_HYDRATION_DIAG_THRESHOLD,
});

/**
 * Emits `messaging.dm_read_authority_bridge_used` (first N resolves + any non-projection source).
 * Call after {@link resolveHydrationDmReadMessages} from production hydrate paths.
 */
export const logDmReadHydrationDiagnostics = (
  params: DmHydrationMigrationParams,
  status: DmReadAuthorityStatus,
): void => {
  dmReadHydrationDiagCount++;
  if (dmReadHydrationDiagCount <= DM_READ_HYDRATION_DIAG_THRESHOLD || status.source !== "projection") {
    logAppEvent({
      name: "messaging.dm_read_authority_bridge_used",
      level: status.source === "projection" ? "info" : "warn",
      scope: { feature: "messaging", action: "dm_read_authority_bridge" },
      context: {
        bridgeUsageCount: dmReadHydrationDiagCount,
        source: status.source,
        reason: status.reason,
        conversationId: params.conversationId ?? null,
        projectionMessageCount: params.projectionMessages.length,
        indexedMessageCount: params.indexedMessages.length,
        legacyPersistedCount: params.legacyPersistedMessages.length,
      },
    });
  }
};
