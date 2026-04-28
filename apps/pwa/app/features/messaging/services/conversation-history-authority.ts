/**
 * @deprecated This module is QUARANTINED per HEURISTIC_PATH_QUARANTINE.md.
 * Use dm-read-authority-contract.ts instead for all new code.
 * This file will be removed in v1.5.0 after all call sites are migrated.
 * Last updated: 2026-04-24
 */

export type ConversationHistoryAuthority = "projection" | "indexed" | "persisted";

export type ConversationHistoryAuthorityReason =
  | "projection_read_cutover"
  | "persisted_recovery_indexed_missing_incoming"
  | "persisted_recovery_indexed_missing_outgoing"
  | "persisted_recovery_indexed_empty"
  | "indexed_primary";

export type ResolveConversationHistoryAuthorityParams = Readonly<{
  useProjectionReads: boolean;
  projectionMessageCount: number;
  projectionIncomingCount: number;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  projectionRestorePhaseActive: boolean;
  indexedMessageCount: number;
  indexedOutgoingCount: number;
  indexedIncomingCount: number;
  persistedMessageCount: number;
  persistedOutgoingCount: number;
  persistedIncomingCount: number;
}>;

export type ConversationHistoryAuthorityDecision = Readonly<{
  authority: ConversationHistoryAuthority;
  reason: ConversationHistoryAuthorityReason;
}>;

export const PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX = 3;

export const hasIndexedThinnessEvidenceForPersistedIncomingRepair = (
  indexedMessageCount: number,
): boolean => (
  Number.isFinite(indexedMessageCount)
  && indexedMessageCount > 0
  && indexedMessageCount <= PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX
);

type PersistedCompatibilityRestorePhaseIncomingRepairCandidateParams = Readonly<{
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

let deprecationWarningEmitted = false;

const emitDeprecationWarning = (): void => {
  if (typeof window !== "undefined" && !deprecationWarningEmitted) {
    deprecationWarningEmitted = true;
    console.warn(
      "[QUARANTINED] conversation-history-authority.ts is deprecated. " +
      "Use dm-read-authority-contract.ts instead. See HEURISTIC_PATH_QUARANTINE.md"
    );
  }
};

export const resolveConversationHistoryAuthority = (
  params: ResolveConversationHistoryAuthorityParams,
): ConversationHistoryAuthorityDecision => {
  emitDeprecationWarning();
  if (params.useProjectionReads && params.projectionMessageCount > 0) {
    return {
      authority: "projection",
      reason: "projection_read_cutover",
    };
  }

  const persistedIncomingMissingFromThinIndexedRestoreWindow = (
    params.projectionCanonicalEvidencePending === true
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
    params.projectionCanonicalEvidencePending === true
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

  if (params.persistedMessageCount > 0 && params.indexedMessageCount === 0) {
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
