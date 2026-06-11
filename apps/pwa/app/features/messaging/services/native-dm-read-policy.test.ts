import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isNativeDmSqliteReadOwner } from "./native-dm-read-policy";
import { resolveHydrationDmReadMessages, resolveLegacyHydrationAuthority } from "./dm-read-authority-contract";
import { assembleDmHydrateThreadReadModel } from "./dm-conversation-hydrate-read-model";
import {
  buildHydrateSupplementalMessages,
  evaluateProjectionMergePolicy,
  resolveInitialConversationPaint,
  shouldPersistDmThreadDisplayCache,
} from "./dm-thread-read-model";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const pk = "aa".repeat(32) as PublicKeyHex;

const mk = (id: string, isOutgoing = false): Message => ({
  id,
  kind: "user",
  content: id,
  timestamp: new Date(1),
  isOutgoing,
  status: "delivered",
  conversationId: "dm:x:y",
  senderPubkey: isOutgoing ? pk : ("bb".repeat(32) as PublicKeyHex),
  recipientPubkey: isOutgoing ? ("bb".repeat(32) as PublicKeyHex) : pk,
});

describe("native DM R1 read policy", () => {
  beforeEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("isNativeDmSqliteReadOwner tracks requiresSqlitePersistence", () => {
    expect(isNativeDmSqliteReadOwner()).toBe(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isNativeDmSqliteReadOwner()).toBe(true);
  });

  describe("when native", () => {
    beforeEach(() => {
      vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    });

    it("resolveLegacyHydrationAuthority always selects indexed_primary", () => {
      expect(resolveLegacyHydrationAuthority({
        useProjectionReads: true,
        projectionMessageCount: 5,
        projectionIncomingCount: 3,
        projectionOutgoingCount: 2,
        projectionBootstrapImportApplied: true,
        projectionCanonicalEvidencePending: false,
        projectionRestorePhaseActive: false,
        indexedMessageCount: 1,
        indexedOutgoingCount: 1,
        indexedIncomingCount: 0,
        persistedMessageCount: 10,
        persistedOutgoingCount: 5,
        persistedIncomingCount: 5,
      })).toEqual({
        authority: "indexed",
        reason: "indexed_primary",
      });
    });

    it("resolveHydrationDmReadMessages returns sqlite rows only", () => {
      const indexedMessages = [mk("sqlite-in", false), mk("sqlite-out", true)];
      const r = resolveHydrationDmReadMessages({
        identityPubkey: pk,
        conversationId: "dm:x:y",
        projectionMessages: [mk("proj-only", false)],
        indexedMessages,
        legacyPersistedMessages: [mk("chat-state-1")],
        projectionReady: true,
        scopeVerified: true,
        useProjectionReads: true,
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
      expect(r.messages.map((m) => m.id)).toEqual(["sqlite-in", "sqlite-out"]);
      expect(r.legacyAuthorityDecision.reason).toBe("indexed_primary");
    });

    it("assembleDmHydrateThreadReadModel does not projection gap-fill", () => {
      const assembled = assembleDmHydrateThreadReadModel({
        conversationId: "dm:x:y",
        conversationIds: ["dm:x:y"],
        retentionFilteredMapped: [mk("sqlite-out", true)],
        cappedHydratedMessages: [mk("sqlite-out", true)],
        scannedWindowHasEarlier: false,
        shouldCapHydratedHistoryWindow: false,
        normalizedPublicKeyHex: pk,
        projectionMessagesSnapshot: [mk("proj-in", false)],
        projectionEvidenceMessagesSnapshot: [mk("proj-evidence-in", false)],
        projectionReadAuthoritySnapshot: {
          useProjectionReads: true,
          reason: "ready",
          criticalDriftCount: 0,
        },
        projectionRestorePhaseActive: false,
        projectionBootstrapImportApplied: true,
        projectionCanonicalEvidencePending: false,
        persistedStateFallbackMessages: [],
        liveMessages: [],
        expandedHistory: false,
        persistentSuppressedMessageIds: new Set(),
        liveWindowSoftLimit: 200,
      });
      expect(assembled.finalMessages.some((m) => m.id === "proj-in")).toBe(false);
      expect(assembled.finalMessages.some((m) => m.id === "sqlite-out")).toBe(true);
    });

    it("blocks projection merge, supplemental hydrate, display cache, and cache persist", () => {
      const bidirectional = [mk("in-1", false), mk("out-1", true)];
      expect(evaluateProjectionMergePolicy({
        projectionMessages: bidirectional,
        previousMessages: [mk("sqlite-out", true)],
        myPublicKeyHex: pk,
        suppressUntilHydrate: false,
      }).shouldMerge).toBe(false);
      expect(buildHydrateSupplementalMessages(
        [mk("sqlite-out", true)],
        pk,
        [mk("supplemental-in", false)],
        [mk("projection-in", false)],
      )).toEqual([]);
      expect(resolveInitialConversationPaint({
        displayCache: bidirectional,
        syncSeed: [],
        myPublicKeyHex: pk,
      }).shouldPaint).toBe(false);
      expect(shouldPersistDmThreadDisplayCache(bidirectional, pk)).toBe(false);
    });
  });
});
