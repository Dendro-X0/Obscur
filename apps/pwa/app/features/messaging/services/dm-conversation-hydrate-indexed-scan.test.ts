import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { messagingDB } from "@dweb/storage/indexed-db";
import {
  loadConversationWindow,
  loadConversationWindowAcrossAliases,
  loadInitialDmHydrationIndexedWindow,
} from "@/app/features/messaging/services/thread-history/dm-thread-history-legacy-port";

vi.mock("@dweb/db", () => ({
  dbGetMessages: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(({ primaryProfileId }: { primaryProfileId: string }) => [primaryProfileId]),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dbGetMessages } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";

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

  it("loadConversationWindowAcrossAliases dedupes SQLite rows by eventId on native", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(dbGetMessages).mockImplementation(async (_profileId, conversationId) => {
      if (conversationId === "ca") {
        return [{
          event_id: "dup-event",
          conversation_id: "ca",
          plaintext: "a",
          sender_pubkey: "aa",
          recipient_pubkey: "bb",
          is_outgoing: false,
          kind: "user",
          received_at: 100,
        }] as any;
      }
      if (conversationId === "cb") {
        return [{
          event_id: "dup-event",
          conversation_id: "cb",
          plaintext: "b",
          sender_pubkey: "aa",
          recipient_pubkey: "bb",
          is_outgoing: false,
          kind: "user",
          received_at: 200,
        }] as any;
      }
      return [];
    });

    const result = await loadConversationWindowAcrossAliases({
      conversationIds: ["ca", "cb"],
      limit: 10,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("dup-event");
    expect(result.rows[0]?.timestampMs).toBe(200);
    expect(vi.mocked(messagingDB.getAllByIndex)).not.toHaveBeenCalled();
  });

  it("loadInitialDmHydrationIndexedWindow returns empty on web without IndexedDB window", async () => {
    const mapRows = (rows: ReadonlyArray<any>): ReadonlyArray<Message> => rows.map((row) => mkMessage({
      id: String(row.id),
      timestampMs: Number(row.timestampMs),
      conversationId: String(row.conversationId),
    }));

    const out = await loadInitialDmHydrationIndexedWindow({
      conversationIds: ["c1"],
      initialBatchSize: 1,
      mapRows,
      targetVisibleCount: 2,
      maxPassCount: 4,
      liveWindowSoftLimit: 50,
    });

    expect(out.retentionFilteredMapped).toHaveLength(0);
    expect(out.hasEarlier).toBe(false);
    expect(vi.mocked(messagingDB.getAllByIndex)).not.toHaveBeenCalled();
  });

  it("loadConversationWindow merges sqlite rows across account-shared profile slots on native", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const account = "cc".repeat(32);
    vi.mocked(listAccountSharedSqliteProfileIds).mockReturnValue(["default", "profile-secondary"]);
    vi.mocked(dbGetMessages).mockImplementation(async (profileId) => {
      if (profileId === "default") {
        return [{
          event_id: "outgoing-main",
          conversation_id: "c-native",
          plaintext: "from main",
          sender_pubkey: account,
          recipient_pubkey: "bb".repeat(32),
          is_outgoing: true,
          kind: "user",
          received_at: 1000,
        }] as any;
      }
      if (profileId === "profile-secondary") {
        return [{
          event_id: "incoming-secondary",
          conversation_id: "c-native",
          plaintext: "from peer",
          sender_pubkey: "bb".repeat(32),
          recipient_pubkey: account,
          is_outgoing: false,
          kind: "user",
          received_at: 2000,
        }] as any;
      }
      return [];
    });

    const rows = await loadConversationWindow({
      conversationId: "c-native",
      limit: 10,
      accountPublicKeyHex: account,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual(["incoming-secondary", "outgoing-main"].sort());
    expect(vi.mocked(dbGetMessages)).toHaveBeenCalledTimes(2);
  });

  it("loadConversationWindow drops cross-slot rows that do not involve the active account", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const account = "cc".repeat(32);
    vi.mocked(listAccountSharedSqliteProfileIds).mockReturnValue(["default", "profile-secondary"]);
    vi.mocked(dbGetMessages).mockImplementation(async (profileId) => {
      if (profileId === "default") {
        return [{
          event_id: "other-account-outgoing",
          conversation_id: "c-native",
          plaintext: "wrong account",
          sender_pubkey: "dd".repeat(32),
          recipient_pubkey: "ee".repeat(32),
          is_outgoing: true,
          kind: "user",
          received_at: 3000,
        }] as any;
      }
      return [{
        event_id: "self-incoming",
        conversation_id: "c-native",
        plaintext: "peer",
        sender_pubkey: "bb".repeat(32),
        recipient_pubkey: account,
        is_outgoing: false,
        kind: "user",
        received_at: 2000,
      }] as any;
    });

    const rows = await loadConversationWindow({
      conversationId: "c-native",
      limit: 10,
      accountPublicKeyHex: account,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("self-incoming");
  });

  it("loadConversationWindow uses SQLite only on native and does not fall back to IndexedDB", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "evt-1",
        conversation_id: "c-native",
        plaintext: "hi",
        sender_pubkey: "aa",
        recipient_pubkey: "bb",
        is_outgoing: true,
        kind: "user",
        received_at: 1000,
      },
    ] as any);

    const rows = await loadConversationWindow({
      conversationId: "c-native",
      limit: 10,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("evt-1");
    expect(vi.mocked(dbGetMessages)).toHaveBeenCalled();
    expect(vi.mocked(messagingDB.getAllByIndex)).not.toHaveBeenCalled();

    vi.mocked(dbGetMessages).mockRejectedValue(new Error("sqlite down"));
    const empty = await loadConversationWindow({
      conversationId: "c-native",
      limit: 10,
    });
    expect(empty).toEqual([]);
    expect(vi.mocked(messagingDB.getAllByIndex)).not.toHaveBeenCalled();
  });

  it("P5-DM-2: returns SQLite messages older than 7 days (no implicit age purge)", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    const oldTimestampMs = Date.now() - eightDaysMs;
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "evt-old",
        conversation_id: "c-survival",
        plaintext: "still here",
        sender_pubkey: "aa",
        recipient_pubkey: "bb",
        is_outgoing: false,
        kind: "user",
        received_at: oldTimestampMs,
      },
    ] as any);

    const rows = await loadConversationWindow({
      conversationId: "c-survival",
      limit: 50,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("evt-old");
    expect(rows[0]?.timestampMs).toBe(oldTimestampMs);
  });
});
