import { describe, expect, it } from "vitest";
import {
  PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX,
  hasIndexedThinnessEvidenceForPersistedIncomingRepair,
  isPersistedCompatibilityRestorePhaseIncomingRepairCandidate,
  resolveConversationHistoryAuthority,
} from "./conversation-history-authority";

describe("resolveConversationHistoryAuthority", () => {
  it("prefers projection when projection reads are enabled and messages are present", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: true,
      projectionMessageCount: 5,
      projectionIncomingCount: 3,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 4,
      indexedOutgoingCount: 2,
      indexedIncomingCount: 2,
      persistedMessageCount: 6,
      persistedOutgoingCount: 3,
      persistedIncomingCount: 3,
    })).toEqual({
      authority: "projection",
      reason: "projection_read_cutover",
    });
  });

  it("prefers persisted when indexed history is empty", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 0,
      indexedOutgoingCount: 0,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_recovery_indexed_empty",
    });
  });

  it("prefers persisted when restore-phase canonical evidence is pending and indexed history is thinner", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_recovery_indexed_missing_incoming",
    });
  });

  it("keeps indexed as primary when outgoing-only indexed history is no longer thin enough for persisted incoming repair", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX + 1,
      indexedOutgoingCount: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX + 1,
      indexedIncomingCount: 0,
      persistedMessageCount: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX + 2,
      persistedOutgoingCount: PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX + 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("prefers persisted when restore-phase indexed history is missing outgoing coverage", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 1,
      indexedOutgoingCount: 0,
      indexedIncomingCount: 1,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_recovery_indexed_missing_outgoing",
    });
  });

  it("does not let persisted coverage repair outrank indexed history once read cutover is active", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: true,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("keeps indexed as the primary authority when it already has usable coverage", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 2,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 1,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("treats only small indexed windows as thin enough for persisted incoming repair", () => {
    expect(hasIndexedThinnessEvidenceForPersistedIncomingRepair(1)).toBe(true);
    expect(hasIndexedThinnessEvidenceForPersistedIncomingRepair(PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX)).toBe(true);
    expect(hasIndexedThinnessEvidenceForPersistedIncomingRepair(PERSISTED_INCOMING_REPAIR_INDEXED_MESSAGE_MAX + 1)).toBe(false);
  });

  it("keeps the final restore-phase incoming bridge candidate separately diagnosable", () => {
    expect(isPersistedCompatibilityRestorePhaseIncomingRepairCandidate({
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedIncomingCount: 1,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      allowCoverageRepair: true,
    })).toBe(true);
    expect(isPersistedCompatibilityRestorePhaseIncomingRepairCandidate({
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedIncomingCount: 1,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: false,
      allowCoverageRepair: true,
    })).toBe(false);
  });

  it("keeps indexed as primary when canonical projection already has incoming evidence", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 1,
      projectionIncomingCount: 1,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("keeps indexed as primary when canonical bootstrap import already applied even if projection lacks incoming evidence", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("keeps indexed as primary when canonical evidence is no longer pending even if bootstrap import has not applied", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("keeps indexed as primary when canonical evidence is pending but restore phase is not active", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("keeps indexed as primary when restore-phase history is richer but not one-sidedly missing", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 2,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 1,
      persistedMessageCount: 5,
      persistedOutgoingCount: 2,
      persistedIncomingCount: 3,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("prefers persisted when restore-phase indexed history is missing outgoing coverage", () => {
    expect(resolveConversationHistoryAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 1,
      indexedOutgoingCount: 0,
      indexedIncomingCount: 1,
      persistedMessageCount: 2,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 1,
    })).toEqual({
      authority: "persisted",
      reason: "persisted_recovery_indexed_missing_outgoing",
    });
  });
});
