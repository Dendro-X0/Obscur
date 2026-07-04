import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  resolveHydrationDmReadMessages,
  resolveLegacyHydrationAuthority,
} from "@/app/features/messaging/services/dm-read-authority-port";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

const pk = "aa".repeat(32) as PublicKeyHex;

const mk = (id: string, isOutgoing = false): Message => ({
  id,
  kind: "user",
  content: id,
  timestamp: new Date(1),
  isOutgoing,
  status: "delivered",
  conversationId: "dm:x:y",
});

describe("DM hydrate authority on native (P3b)", () => {
  afterEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("always selects indexed_primary on native regardless of projection coverage", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(resolveLegacyHydrationAuthority({
      useProjectionReads: false,
      projectionMessageCount: 2,
      projectionIncomingCount: 1,
      projectionOutgoingCount: 1,
      projectionBootstrapImportApplied: true,
      projectionCanonicalEvidencePending: false,
      projectionRestorePhaseActive: false,
      indexedMessageCount: 3,
      indexedOutgoingCount: 3,
      indexedIncomingCount: 0,
      persistedMessageCount: 0,
      persistedOutgoingCount: 0,
      persistedIncomingCount: 0,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("resolveLegacyHydrationAuthority skips chat-state persisted repair on native", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(resolveLegacyHydrationAuthority({
      useProjectionReads: false,
      projectionMessageCount: 0,
      projectionIncomingCount: 0,
      projectionOutgoingCount: 0,
      projectionBootstrapImportApplied: false,
      projectionCanonicalEvidencePending: true,
      projectionRestorePhaseActive: true,
      indexedMessageCount: 1,
      indexedOutgoingCount: 1,
      indexedIncomingCount: 0,
      persistedMessageCount: 5,
      persistedOutgoingCount: 1,
      persistedIncomingCount: 4,
    })).toEqual({
      authority: "indexed",
      reason: "indexed_primary",
    });
  });

  it("resolveHydrationDmReadMessages does not return chat-state messages on native", () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const indexedMessages = [mk("sqlite-1")];
    const legacyPersistedMessages = [mk("chat-state-1"), mk("chat-state-2", true)];
    const r = resolveHydrationDmReadMessages({
      identityPubkey: pk,
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
      indexedOutgoingCount: 0,
      indexedIncomingCount: 1,
      persistedIncomingCount: 0,
      persistedOutgoingCount: 2,
    });
    expect(r.legacyAuthorityDecision.authority).toBe("indexed");
    expect(r.messages.map((m) => m.id)).toEqual(["sqlite-1"]);
    expect(r.status.source).toBe("indexed_recovery");
  });
});
