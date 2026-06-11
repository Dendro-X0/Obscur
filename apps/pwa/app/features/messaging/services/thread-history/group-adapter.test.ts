import { beforeEach, describe, expect, it, vi } from "vitest";
import { groupThreadHistoryAdapter } from "./group-adapter";

vi.mock("./group-thread-sqlite-store", () => ({
  loadGroupThreadPageFromSqlite: vi.fn(async () => ({
    messages: [{ id: "evt-1" }],
    hasEarlier: true,
    didExpandHistory: false,
    nextCursor: null,
  })),
  loadGroupThreadEarlierFromSqlite: vi.fn(async () => ({
    messages: [{ id: "evt-older" }, { id: "evt-1" }],
    hasEarlier: false,
    didExpandHistory: true,
    nextCursor: null,
  })),
  resolveGroupStorageId: vi.fn(() => "group-1"),
}));

import {
  loadGroupThreadEarlierFromSqlite,
  loadGroupThreadPageFromSqlite,
} from "./group-thread-sqlite-store";

describe("groupThreadHistoryAdapter", () => {
  beforeEach(() => {
    vi.mocked(loadGroupThreadPageFromSqlite).mockClear();
    vi.mocked(loadGroupThreadEarlierFromSqlite).mockClear();
  });

  it("hydrates from sqlite read path", async () => {
    const result = await groupThreadHistoryAdapter.hydrateThreadReadModel({
      conversationId: "community:group-1",
      normalizedPublicKeyHex: "a".repeat(64),
      numeric: { liveWindowSoftLimit: 200 },
    } as never);
    expect(loadGroupThreadPageFromSqlite).toHaveBeenCalled();
    expect(result.finalMessages).toEqual([{ id: "evt-1" }]);
    expect(result.hasEarlier).toBe(true);
    expect(result.authorityDiagnosticKey).toBe("thread-history:group-sqlite");
  });

  it("loads earlier pages through sqlite cursor", async () => {
    const result = await groupThreadHistoryAdapter.loadEarlierMessages({
      conversationId: "community:group-1",
      conversationAliasIds: ["community:group-1"],
      earliestTimestampMs: 1_000,
      loadEarlierBatchSize: 200,
      publicKeyHex: "a".repeat(64),
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: 0,
      existingMessages: [{ id: "evt-1" } as never],
    });
    expect(loadGroupThreadEarlierFromSqlite).toHaveBeenCalled();
    expect(result.messages).toHaveLength(2);
    expect(result.didExpandHistory).toBe(true);
  });
});
