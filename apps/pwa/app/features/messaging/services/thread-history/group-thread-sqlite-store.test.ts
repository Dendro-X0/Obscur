import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadGroupThreadEarlierFromSqlite,
  loadGroupThreadPageFromSqlite,
  mapGroupMessageRecordToMessage,
  mergeGroupMessageRecordsForPage,
  resolveGroupStorageId,
} from "./group-thread-sqlite-store";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbGetGroupMessages: vi.fn(async () => []),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-1"),
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  readActiveDesktopProfileId: vi.fn(() => "desktop-profile-slot"),
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getDefaultProfileId: vi.fn(() => "default"),
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(({ primaryProfileId }: { primaryProfileId: string }) => [
    primaryProfileId,
    "profile-secondary",
  ]),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dbGetGroupMessages, isTauri } from "@dweb/db";
import { listAccountSharedSqliteProfileIds } from "@/app/features/profiles/services/account-shared-sqlite-profile-ids";

describe("group-thread-sqlite-store", () => {
  beforeEach(() => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(dbGetGroupMessages).mockReset();
    vi.mocked(dbGetGroupMessages).mockResolvedValue([]);
  });

  it("resolveGroupStorageId prefers explicit groupId", () => {
    expect(resolveGroupStorageId({
      conversationId: "community:legacy",
      groupId: "group-1",
    })).toBe("group-1");
  });

  it("maps sqlite rows to ascending chat messages", () => {
    const message = mapGroupMessageRecordToMessage({
      record: {
        event_id: "evt-1",
        group_id: "group-1",
        profile_id: "profile-1",
        sender_pubkey: "b".repeat(64),
        plaintext: "hello",
        created_at: 100,
        received_at: 1_000,
      },
      conversationId: "community:group-1",
      myPublicKeyHex: "a".repeat(64),
    });
    expect(message.id).toBe("evt-1");
    expect(message.isOutgoing).toBe(false);
    expect(message.timestamp.getTime()).toBe(1_000);
  });

  it("loads latest page from sqlite on native", async () => {
    vi.mocked(dbGetGroupMessages).mockResolvedValue([
      {
        event_id: "evt-new",
        group_id: "group-1",
        profile_id: "profile-1",
        sender_pubkey: "b".repeat(64),
        plaintext: "new",
        created_at: 200,
        received_at: 2_000,
      },
      {
        event_id: "evt-old",
        group_id: "group-1",
        profile_id: "profile-1",
        sender_pubkey: "b".repeat(64),
        plaintext: "old",
        created_at: 100,
        received_at: 1_000,
      },
    ]);
    const page = await loadGroupThreadPageFromSqlite({
      conversationId: "community:group-1",
      groupId: "group-1",
      myPublicKeyHex: "a".repeat(64),
      pageSize: 200,
    });
    expect(listAccountSharedSqliteProfileIds).toHaveBeenCalled();
    expect(dbGetGroupMessages).toHaveBeenCalledWith("desktop-profile-slot", "group-1", 200, undefined);
    expect(dbGetGroupMessages).toHaveBeenCalledWith("profile-secondary", "group-1", 200, undefined);
    expect(page.messages.map((message) => message.id)).toEqual(["evt-old", "evt-new"]);
    expect(page.hasEarlier).toBe(false);
  });

  it("merges duplicate event ids across profile slots (B3-3 multi-slot scan)", async () => {
    vi.mocked(dbGetGroupMessages).mockImplementation(async (profileId: string) => {
      if (profileId === "desktop-profile-slot") {
        return [{
          event_id: "evt-shared",
          group_id: "group-1",
          profile_id: profileId,
          sender_pubkey: "b".repeat(64),
          plaintext: "stale copy",
          created_at: 100,
          received_at: 1_000,
        }];
      }
      return [{
        event_id: "evt-shared",
        group_id: "group-1",
        profile_id: profileId,
        sender_pubkey: "b".repeat(64),
        plaintext: "fresh copy",
        created_at: 200,
        received_at: 2_000,
      }, {
        event_id: "evt-secondary-only",
        group_id: "group-1",
        profile_id: profileId,
        sender_pubkey: "b".repeat(64),
        plaintext: "secondary slot",
        created_at: 150,
        received_at: 1_500,
      }];
    });

    const page = await loadGroupThreadPageFromSqlite({
      conversationId: "community:group-1",
      groupId: "group-1",
      myPublicKeyHex: "a".repeat(64),
      pageSize: 200,
    });

    expect(page.messages.map((message) => message.content)).toEqual([
      "secondary slot",
      "fresh copy",
    ]);
  });

  it("mergeGroupMessageRecordsForPage keeps newest received_at per event id", () => {
    const merged = mergeGroupMessageRecordsForPage([
      {
        event_id: "evt-1",
        group_id: "group-1",
        profile_id: "profile-a",
        sender_pubkey: "b".repeat(64),
        plaintext: "old",
        created_at: 100,
        received_at: 1_000,
      },
      {
        event_id: "evt-1",
        group_id: "group-1",
        profile_id: "profile-b",
        sender_pubkey: "b".repeat(64),
        plaintext: "new",
        created_at: 200,
        received_at: 2_000,
      },
    ], 10);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.plaintext).toBe("new");
  });

  it("returns empty page when sqlite persistence is unavailable", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    const page = await loadGroupThreadPageFromSqlite({
      conversationId: "community:group-1",
      groupId: "group-1",
      myPublicKeyHex: "a".repeat(64),
    });
    expect(page.messages).toEqual([]);
    expect(dbGetGroupMessages).not.toHaveBeenCalled();
  });

  it("prepends earlier sqlite page without dropping existing messages", async () => {
    vi.mocked(dbGetGroupMessages).mockResolvedValue([
      {
        event_id: "evt-older",
        group_id: "group-1",
        profile_id: "profile-1",
        sender_pubkey: "b".repeat(64),
        plaintext: "older",
        created_at: 50,
        received_at: 500,
      },
    ]);
    const existing = [{
      id: "evt-old",
      kind: "user" as const,
      content: "old",
      timestamp: new Date(1_000),
      isOutgoing: false,
      status: "delivered" as const,
      conversationId: "community:group-1",
    }];
    const page = await loadGroupThreadEarlierFromSqlite({
      conversationId: "community:group-1",
      groupId: "group-1",
      myPublicKeyHex: "a".repeat(64),
      existingMessages: existing,
      beforeReceivedAtMs: 1_000,
      pageSize: 200,
    });
    expect(page.messages.map((message) => message.id)).toEqual(["evt-older", "evt-old"]);
    expect(page.didExpandHistory).toBe(true);
  });
});
