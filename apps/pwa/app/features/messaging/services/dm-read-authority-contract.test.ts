import { describe, expect, it, vi } from "vitest";
import {
  resolveDmReadAuthority,
  selectMessagesByAuthority,
  resolveHydrationDmReadMessages,
  resolveLegacyHydrationAuthority,
  isCanonicalDmReadPath,
  formatDmReadAuthorityForDiagnostics,
  type DmReadAuthorityParams,
} from "./dm-read-authority-contract";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const pkHydration = "a".repeat(64) as PublicKeyHex;

const createMinimalMessage = (id: string): Message => ({
  id,
  kind: "user",
  content: "x",
  timestamp: new Date(0),
  isOutgoing: false,
  status: "delivered",
});

const createMockMessage = (id: string): Message => ({
  id,
  kind: "user",
  conversationId: "conv-1",
  senderPubkey: "sender1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
  recipientPubkey: "recipient1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
  content: "test",
  timestamp: new Date(),
  isOutgoing: true,
  status: "delivered",
});

describe("dm-read-authority-contract", () => {
  const baseParams: DmReadAuthorityParams = {
    identityPubkey: "pubkey1" as import("@dweb/crypto/public-key-hex").PublicKeyHex,
    conversationId: "conv-1",
    projectionMessages: [],
    indexedMessages: [],
    legacyPersistedMessages: [],
    projectionReady: true,
    scopeVerified: true,
    allowIndexedRecovery: false,
    allowLegacyRecovery: false,
  };

  describe("resolveDmReadAuthority", () => {
    it("returns canonical projection when ready with messages", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [createMockMessage("msg-1")],
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("projection");
      expect(result.reason).toBe("projection_ready");
      expect(result.isCanonical).toBe(true);
    });

    it("returns none when all sources are empty", () => {
      const result = resolveDmReadAuthority(baseParams);
      expect(result.source).toBe("none");
      expect(result.reason).toBe("all_sources_empty");
      expect(result.isCanonical).toBe(false);
    });

    it("blocks when identity is missing", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        identityPubkey: null,
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("none");
      expect(result.reason).toBe("no_identity");
      expect(result.isCanonical).toBe(false);
    });

    it("blocks when conversation ID is missing", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        conversationId: null,
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("none");
      expect(result.reason).toBe("no_conversation_id");
      expect(result.isCanonical).toBe(false);
    });

    it("blocks when scope is not verified", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        scopeVerified: false,
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("none");
      expect(result.reason).toBe("projection_drift_fallback_blocked");
      expect(result.isCanonical).toBe(false);
    });

    it("allows indexed recovery when projection empty and explicitly allowed", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        indexedMessages: [createMockMessage("msg-1")],
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("indexed_recovery");
      expect(result.reason).toBe("projection_empty_recovery_from_indexed");
      expect(result.isCanonical).toBe(false);
    });

    it("prefers projection over indexed even when indexed has messages", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [createMockMessage("msg-proj")],
        indexedMessages: [createMockMessage("msg-idx")],
        allowIndexedRecovery: true,
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("projection");
      expect(result.isCanonical).toBe(true);
    });

    it("allows legacy recovery when projection and indexed empty but explicitly allowed", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowLegacyRecovery: true,
        legacyPersistedMessages: [createMockMessage("msg-1")],
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("legacy_persisted");
      expect(result.reason).toBe("projection_empty_recovery_from_legacy");
      expect(result.isCanonical).toBe(false);
    });

    it("prefers indexed over legacy when both have messages and both allowed", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        allowLegacyRecovery: true,
        indexedMessages: [createMockMessage("msg-idx")],
        legacyPersistedMessages: [createMockMessage("msg-legacy")],
      };
      const result = resolveDmReadAuthority(params);
      expect(result.source).toBe("indexed_recovery");
    });

    it("includes diagnostics in result", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [createMockMessage("msg-1")],
        indexedMessages: [createMockMessage("msg-2"), createMockMessage("msg-3")],
      };
      const result = resolveDmReadAuthority(params);
      expect(result.diagnostics.projectionMessageCount).toBe(1);
      expect(result.diagnostics.indexedMessageCount).toBe(2);
      expect(result.diagnostics.legacyPersistedCount).toBe(0);
      expect(result.diagnostics.scopeVerified).toBe(true);
    });
  });

  describe("selectMessagesByAuthority", () => {
    it("selects projection messages when canonical", () => {
      const projMsg = createMockMessage("proj");
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [projMsg],
        indexedMessages: [createMockMessage("idx")],
      };
      const messages = selectMessagesByAuthority(params);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("proj");
    });

    it("selects indexed messages when in recovery mode", () => {
      const idxMsg = createMockMessage("idx");
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        indexedMessages: [idxMsg],
      };
      const messages = selectMessagesByAuthority(params);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("idx");
    });

    it("selects legacy messages when in legacy recovery mode", () => {
      const legacyMsg = createMockMessage("legacy");
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        allowLegacyRecovery: true,
        legacyPersistedMessages: [legacyMsg],
      };
      const messages = selectMessagesByAuthority(params);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("legacy");
    });

    it("returns empty array when authority is none", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        identityPubkey: null,
      };
      const messages = selectMessagesByAuthority(params);
      expect(messages).toHaveLength(0);
    });
  });

  describe("isCanonicalDmReadPath", () => {
    it("returns true for canonical projection", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [createMockMessage("msg-1")],
      };
      const status = resolveDmReadAuthority(params);
      expect(isCanonicalDmReadPath(status)).toBe(true);
    });

    it("returns false for indexed recovery", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        indexedMessages: [createMockMessage("msg-1")],
      };
      const status = resolveDmReadAuthority(params);
      expect(isCanonicalDmReadPath(status)).toBe(false);
    });

    it("returns false for legacy recovery", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowLegacyRecovery: true,
        legacyPersistedMessages: [createMockMessage("msg-1")],
      };
      const status = resolveDmReadAuthority(params);
      expect(isCanonicalDmReadPath(status)).toBe(false);
    });
  });

  describe("formatDmReadAuthorityForDiagnostics", () => {
    it("formats canonical status correctly", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        projectionMessages: [createMockMessage("msg-1")],
      };
      const status = resolveDmReadAuthority(params);
      const formatted = formatDmReadAuthorityForDiagnostics(status);
      expect(formatted).toContain("[CANONICAL]");
      expect(formatted).toContain("projection");
      expect(formatted).toContain("projection_ready");
    });

    it("formats non-canonical status correctly", () => {
      const params: DmReadAuthorityParams = {
        ...baseParams,
        allowIndexedRecovery: true,
        indexedMessages: [createMockMessage("msg-1")],
      };
      const status = resolveDmReadAuthority(params);
      const formatted = formatDmReadAuthorityForDiagnostics(status);
      expect(formatted).toContain("[NON-CANONICAL]");
      expect(formatted).toContain("indexed_recovery");
    });
  });

  describe("resolveHydrationDmReadMessages", () => {
    it("recovers indexed rows when projection evidence exists but this thread slice is empty", () => {
      const projectionMessages: Message[] = [];
      const indexedMessages = [createMinimalMessage("idx-1")];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages,
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: true,
        scopeVerified: true,
        useProjectionReads: true,
        legacyProjectionEvidenceMessageCount: 1,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 0,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
      });
      expect(r.messages.map((m) => m.id)).toEqual(["idx-1"]);
      expect(r.status.source).toBe("indexed_recovery");
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "projection",
        reason: "projection_read_cutover",
      });
    });

    it("returns indexed messages when projection read cutover is direction-incomplete but sqlite has outgoing", () => {
      const projectionMessages = [{ ...createMinimalMessage("proj-in"), isOutgoing: false }];
      const indexedMessages = [
        { ...createMinimalMessage("idx-in"), isOutgoing: false },
        { ...createMinimalMessage("idx-out"), isOutgoing: true },
      ];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages,
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: true,
        scopeVerified: true,
        useProjectionReads: true,
        legacyProjectionEvidenceMessageCount: 1,
        projectionIncomingCount: 1,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: true,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 1,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
      });
      expect(r.messages.map((m) => m.id)).toEqual(["idx-in", "idx-out"]);
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "indexed",
        reason: "indexed_primary_projection_direction_incomplete",
      });
      expect(r.status.source).toBe("indexed_recovery");
    });

    it("prefers indexed on desktop when projection is incoming-only but sqlite has outgoing", () => {
      vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
      const decision = resolveLegacyHydrationAuthority({
        useProjectionReads: true,
        projectionMessageCount: 2,
        projectionIncomingCount: 2,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: true,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedMessageCount: 2,
        indexedOutgoingCount: 2,
        indexedIncomingCount: 0,
        persistedMessageCount: 0,
        persistedOutgoingCount: 0,
        persistedIncomingCount: 0,
        blockPersistedRestoreRepair: true,
      });
      expect(decision).toEqual({
        authority: "indexed",
        reason: "indexed_primary_projection_direction_incomplete",
      });
      vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    });

    it("prefers indexed on desktop when projection is incoming-only even before sqlite proves outgoing", () => {
      vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
      const decision = resolveLegacyHydrationAuthority({
        useProjectionReads: true,
        projectionMessageCount: 2,
        projectionIncomingCount: 2,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: true,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedMessageCount: 2,
        indexedOutgoingCount: 0,
        indexedIncomingCount: 2,
        persistedMessageCount: 0,
        persistedOutgoingCount: 0,
        persistedIncomingCount: 0,
        blockPersistedRestoreRepair: true,
      });
      expect(decision).toEqual({
        authority: "indexed",
        reason: "indexed_primary_projection_direction_incomplete",
      });
      vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    });

    it("selects indexed when legacy picks indexed", () => {
      const indexedMessages = [createMinimalMessage("i1")];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages: [],
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: false,
        scopeVerified: true,
        useProjectionReads: false,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 0,
        indexedIncomingCount: 1,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
      });
      expect(r.status.source).toBe("indexed_recovery");
      expect(r.messages.map((m) => m.id)).toEqual(["i1"]);
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "indexed",
        reason: "indexed_primary",
      });
    });

    it("uses legacy selection when identity is null", () => {
      const indexedMessages = [createMinimalMessage("i1")];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: null,
        conversationId: "dm:x:y",
        projectionMessages: [],
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: false,
        scopeVerified: true,
        useProjectionReads: false,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 0,
        indexedIncomingCount: 1,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
      });
      expect(r.status.source).toBe("indexed_recovery");
      expect(r.messages.map((m) => m.id)).toEqual(["i1"]);
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "indexed",
        reason: "indexed_primary",
      });
    });

    it("prefers persisted over indexed when legacy authority is persisted (restore-phase repair)", () => {
      const indexedMessages = [{ ...createMinimalMessage("idx-out"), isOutgoing: true }];
      const legacyPersistedMessages = [
        { ...createMinimalMessage("pst-in"), isOutgoing: false },
        { ...createMinimalMessage("pst-out"), isOutgoing: true },
      ];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages: [],
        indexedMessages,
        legacyPersistedMessages,
        projectionReady: false,
        scopeVerified: true,
        useProjectionReads: false,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: true,
        projectionRestorePhaseActive: true,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 0,
        persistedIncomingCount: 1,
        persistedOutgoingCount: 1,
      });
      expect(r.status.source).toBe("legacy_persisted");
      expect(r.messages.map((m) => m.id)).toEqual(["pst-in", "pst-out"]);
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "persisted",
        reason: "persisted_recovery_indexed_missing_incoming",
      });
    });

    it("blocks restore-phase persisted repair when persisted layer would resurrect suppressed rows", () => {
      const indexedMessages = [{ ...createMinimalMessage("idx-out"), isOutgoing: true }];
      const legacyPersistedMessages = [
        { ...createMinimalMessage("pst-in"), isOutgoing: false },
        { ...createMinimalMessage("pst-out"), isOutgoing: true },
      ];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages: [],
        indexedMessages,
        legacyPersistedMessages,
        projectionReady: false,
        scopeVerified: true,
        useProjectionReads: false,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: true,
        projectionRestorePhaseActive: true,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 0,
        persistedIncomingCount: 1,
        persistedOutgoingCount: 1,
        suppressedMessageIds: new Set(["pst-in"]),
      });
      expect(r.status.source).toBe("indexed_recovery");
      expect(r.messages.map((m) => m.id)).toEqual(["idx-out"]);
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "indexed",
        reason: "indexed_primary",
      });
    });

    it("filters indexed and projection layers with suppressedMessageIds", () => {
      const indexedMessages = [
        createMinimalMessage("keep"),
        createMinimalMessage("hide"),
      ];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages: [],
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: false,
        scopeVerified: true,
        useProjectionReads: false,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 0,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 0,
        indexedIncomingCount: 2,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
        suppressedMessageIds: new Set(["hide"]),
      });
      expect(r.messages.map((m) => m.id)).toEqual(["keep"]);
    });

    it("unions projection-only outgoing rows when sqlite wins on direction-incomplete hydrate", () => {
      const indexedMessages = [
        { ...createMinimalMessage("idx-out"), isOutgoing: true },
        { ...createMinimalMessage("idx-in"), isOutgoing: false },
      ];
      const projectionMessages = [
        { ...createMinimalMessage("proj-invite"), isOutgoing: true, content: "{\"type\":\"community-invite\"}" },
      ];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pkHydration,
        conversationId: "dm:x:y",
        projectionMessages,
        indexedMessages,
        legacyPersistedMessages: [],
        projectionReady: true,
        scopeVerified: true,
        useProjectionReads: true,
        legacyProjectionEvidenceMessageCount: projectionMessages.length,
        projectionIncomingCount: 0,
        projectionOutgoingCount: 1,
        projectionBootstrapImportApplied: false,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 1,
        persistedIncomingCount: 0,
        persistedOutgoingCount: 0,
      });
      expect(r.legacyAuthorityDecision).toEqual({
        authority: "indexed",
        reason: "indexed_primary_projection_direction_incomplete",
      });
      expect(r.messages.map((m) => m.id)).toEqual(["idx-out", "idx-in", "proj-invite"]);
    });
  });
});
