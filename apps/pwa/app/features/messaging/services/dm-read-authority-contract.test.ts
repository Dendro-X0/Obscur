import { describe, expect, it } from "vitest";
import {
  resolveDmReadAuthority,
  selectMessagesByAuthority,
  isCanonicalDmReadPath,
  formatDmReadAuthorityForDiagnostics,
  type DmReadAuthorityParams,
} from "./dm-read-authority-contract";
import type { Message } from "../types";

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

    it("returns canonical projection when ready but empty", () => {
      const result = resolveDmReadAuthority(baseParams);
      expect(result.source).toBe("projection");
      expect(result.reason).toBe("projection_ready");
      expect(result.isCanonical).toBe(true);
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
});
