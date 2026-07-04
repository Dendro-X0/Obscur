/**
 * Legacy DM read authority — web hydrate only; types shared via hydrate-authority-types.
 */
export {
  PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX,
  hasIndexedThinnessEvidenceForPersistedIncomingRepair,
  isPersistedCompatibilityRestorePhaseIncomingRepairCandidate,
  resolveDmReadAuthority,
  selectMessagesByAuthority,
  resolveHydrationDmReadMessages,
  resolveLegacyHydrationAuthority,
  isCanonicalDmReadPath,
  formatDmReadAuthorityForDiagnostics,
  isProjectionHydrationDirectionIncomplete,
  isNativeProjectionMissingIndexedDirection,
  isNativeProjectionIncomingOnly,
  mergeIndexedWithMissingProjectionMessages,
  resetDmReadHydrationDiagnosticsForTests,
  getDmReadHydrationDiagnosticsStats,
  logDmReadHydrationDiagnostics,
  type DmReadAuthoritySource,
  type DmReadAuthorityReason,
  type DmReadAuthorityStatus,
  type DmReadAuthorityParams,
  type DmHydrationMigrationParams,
  type MigrationBridgeParams,
  type PersistedCompatibilityRestorePhaseIncomingRepairCandidateParams,
} from "./dm-read-authority-contract";

export type {
  ConversationHistoryAuthority,
  ConversationHistoryAuthorityReason,
  ConversationHistoryAuthorityDecision,
  ResolveConversationHistoryAuthorityParams,
} from "./thread-history/hydrate-authority-types";
