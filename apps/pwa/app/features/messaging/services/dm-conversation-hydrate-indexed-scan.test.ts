import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { messagingDB } from "@dweb/storage/indexed-db";
import {
  loadConversationWindowAcrossAliases,
  loadInitialDmHydrationIndexedWindow,
} from "./dm-conversation-hydrate-indexed-scan";

vi.mock("@dweb/db", () => ({
  isTauri: () => false,
  dbGetMessages: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    getAllByIndex: vi.fn(async () => []),
  },
}));

const mkMessage = (partial: Readonly<{ id: string; timestampMs: number; conversationId?: string; eventId?: string }>): Message => ({
  id: partial.id,
  kind: "user",
  content: "",
  timestamp: new Date(partial.timestampMs),
  isOutgoing: false,
  status: "delivered",
  conversationId: partial.conversationId ?? "c",
  eventId: partial.eventId,
});

describe("dm-conversation-hydrate-indexed-scan", () => {
  beforeEach(() => {
    vi.stubGlobal("IDBKeyRange", {
      bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
    });
    vi.mocked(messagingDB.getAllByIndex).mockReset();
    vi.mocked(messagingDB.getAllByIndex).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loadConversationWindowAcrossAliases returns empty when no conversation ids", async () => {
    const result = await loadConversationWindowAcrossAliases({
      conversationIds: ["", "  "],
      limit: 10,
    });
    expect(result.rows).toEqual([]);
    expect(result.hasEarlier).toBe(false);
    expect(vi.mocked(messagingDB.getAllByIndex)).not.toHaveBeenCalled();
  });

  it("loadConversationWindowAcrossAliases dedupes by eventId and keeps the newer row", async () => {
    vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
      const conversationId = String(range?.lower?.[0] ?? "");
      if (conversationId === "ca") {
        return [{
          id: "local-a",
          eventId: "dup-event",
          conversationId: "ca",
          timestampMs: 100,
          timestamp: new Date(100),
        }] as any;
      }
      if (conversationId === "cb") {
        return [{
          id: "local-b",
          eventId: "dup-event",
          conversationId: "cb",
          timestampMs: 200,
          timestamp: new Date(200),
        }] as any;
      }
      return [];
    });

    const result = await loadConversationWindowAcrossAliases({
      conversationIds: ["ca", "cb"],
      limit: 10,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("local-b");
    expect(result.rows[0]?.timestampMs).toBe(200);
  });

  it("loadInitialDmHydrationIndexedWindow pulls an extra window when mapRows needs more than the first batch", async () => {
    vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
      const upperTimestampMs = Number(range?.upper?.[1] ?? Number.NaN);
      if (!Number.isFinite(upperTimestampMs) || upperTimestampMs >= 500) {
        return [{
          id: "newer",
          eventId: "e-new",
          conversationId: "c1",
          timestampMs: 400,
          timestamp: new Date(400),
        }] as any;
      }
      if (upperTimestampMs >= 350) {
        return [{
          id: "older",
          eventId: "e-old",
          conversationId: "c1",
          timestampMs: 300,
          timestamp: new Date(300),
        }] as any;
      }
      return [];
    });

    const mapRows = (rows: ReadonlyArray<any>): ReadonlyArray<Message> => rows
      .slice()
      .reverse()
      .map((row) => mkMessage({
        id: String(row.id),
        timestampMs: Number(row.timestampMs),
        conversationId: String(row.conversationId),
        eventId: typeof row.eventId === "string" ? row.eventId : undefined,
      }));

    const out = await loadInitialDmHydrationIndexedWindow({
      conversationIds: ["c1"],
      initialBatchSize: 1,
      mapRows,
      targetVisibleCount: 2,
      maxPassCount: 4,
      liveWindowSoftLimit: 50,
    });

    expect(out.retentionFilteredMapped).toHaveLength(2);
    expect(out.retentionFilteredMapped.map((m) => m.id)).toEqual(["older", "newer"]);
    expect(out.hasEarlier).toBe(true);
    expect(vi.mocked(messagingDB.getAllByIndex).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
