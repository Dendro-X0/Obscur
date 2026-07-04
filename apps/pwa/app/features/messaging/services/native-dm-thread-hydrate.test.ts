import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/messaging/services/thread-history/hydrate-indexed-legacy-port", () => ({
  loadLegacyConversationWindowAcrossAliases: vi.fn(async () => ({
    rows: [
      {
        id: "evt-out",
        eventId: "evt-out",
        conversationId: "conv",
        content: "hello",
        senderPubkey: "a".repeat(64),
        recipientPubkey: "b".repeat(64),
        isOutgoing: true,
        timestampMs: 1_700_000_000_000,
      },
      {
        id: "evt-in",
        eventId: "evt-in",
        conversationId: "conv",
        content: "reply",
        senderPubkey: "b".repeat(64),
        recipientPubkey: "a".repeat(64),
        isOutgoing: false,
        timestampMs: 1_700_000_000_100,
      },
    ],
    hasEarlier: true,
  })),
  mapLegacyIndexedConversationRowsForDisplayableScan: vi.fn(
    ({ rows, normalizeRow }: { rows: ReadonlyArray<unknown>; normalizeRow: (row: unknown) => unknown }) => (
      rows.map((row) => normalizeRow(row)).filter(Boolean)
    ),
  ),
}));

vi.mock("./dm-thread-suppression-prepare", () => ({
  prepareDmThreadSuppressionIds: vi.fn(async () => new Set<string>()),
}));

vi.mock("./messaging-client-operations", () => ({
  messagingClientOperations: {
    filterVisibleDmMessages: (messages: ReadonlyArray<unknown>) => messages,
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

import { runLegacyNativeDmThreadHydrateReadModel } from "@/app/features/messaging/services/thread-history/native-dm-thread-hydrate";

const MY_KEY = "a".repeat(64) as PublicKeyHex;

describe("runLegacyNativeDmThreadHydrateReadModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates from a single sqlite window without projection fallback", async () => {
    const persistedDeletedIds = new Set<string>();
    const result = await runLegacyNativeDmThreadHydrateReadModel({
      conversationId: `${MY_KEY}:${"b".repeat(64)}`,
      conversationIds: ["conv-a"],
      profileIdForTombstones: "profile-1",
      messageDeleteTombstones: {} as never,
      persistedDeletedIds,
      publicKeyHex: MY_KEY,
      normalizedPublicKeyHex: MY_KEY,
      localMessageRetentionDays: undefined,
      numeric: {
        initialBatchSize: 200,
        initialHydrationVisibleTarget: 200,
        maxHydrationScanPasses: 12,
        liveWindowSoftLimit: 200,
      },
      projectionMessagesSnapshot: [],
      projectionEvidenceMessagesSnapshot: [],
      projectionReadAuthoritySnapshot: {
        useProjectionReads: false,
        reason: "projection_not_ready",
      } as never,
      accountProjectionPhase: "idle",
      accountProjection: null,
      accountProjectionReady: true,
      liveMessages: [],
      expandedHistory: false,
    });

    expect(result.projectionFallbackHydration).toBe(false);
    expect(result.authorityDecision.reason).toBe("native_sqlite_only");
    expect(result.finalMessages.length).toBeGreaterThan(0);
    expect(result.hasEarlier).toBe(true);
  });
});
