/**
 * Thread history hydrate authority contracts — shared by materialization port and legacy impl.
 */

/** Legacy authority branch labels (materialization + hydrate diagnostics). */
export type ConversationHistoryAuthority = "projection" | "indexed" | "persisted";

/** Named reasons for legacy hydration authority resolution. */
export type ConversationHistoryAuthorityReason =
  | "projection_read_cutover"
  | "persisted_recovery_indexed_missing_incoming"
  | "persisted_recovery_indexed_missing_outgoing"
  | "persisted_recovery_indexed_empty"
  | "indexed_primary"
  | "indexed_primary_projection_direction_incomplete"
  | "native_sqlite_only";

export type ConversationHistoryAuthorityDecision = Readonly<{
  authority: ConversationHistoryAuthority;
  reason: ConversationHistoryAuthorityReason;
}>;

export type ResolveConversationHistoryAuthorityParams = Readonly<{
  useProjectionReads: boolean;
  projectionMessageCount: number;
  projectionIncomingCount: number;
  projectionOutgoingCount: number;
  projectionBootstrapImportApplied: boolean;
  projectionCanonicalEvidencePending: boolean;
  projectionRestorePhaseActive: boolean;
  indexedMessageCount: number;
  indexedOutgoingCount: number;
  indexedIncomingCount: number;
  persistedMessageCount: number;
  persistedOutgoingCount: number;
  persistedIncomingCount: number;
  /** When true, restore-phase persisted repair must not override indexed/projection (DM-001 / R1). */
  blockPersistedRestoreRepair?: boolean;
}>;
