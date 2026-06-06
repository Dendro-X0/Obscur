import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupRecord } from "@dweb/db";
import {
  groupConversationToSqliteRecord,
  mergePersistedGroupRowsForNativeHydrate,
  scheduleNativeGroupListSync,
  sqliteGroupRecordToPersistedGroup,
} from "./community-group-sqlite-store";
import type { GroupConversation } from "@/app/features/messaging/types";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbUpsertGroup: vi.fn(async () => undefined),
  dbGetGroups: vi.fn(async () => []),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dbUpsertGroup } from "@dweb/db";

const LOCAL = "a".repeat(64) as PublicKeyHex;

const sampleGroup = (): GroupConversation => ({
  kind: "group",
  id: "community:g1:wss://relay.test",
  communityId: "g1:wss://relay.test",
  groupId: "g1",
  relayUrl: "wss://relay.test",
  displayName: "Test Group",
  memberPubkeys: [LOCAL],
  lastMessage: "hi",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
  access: "invite-only",
  memberCount: 1,
  adminPubkeys: [],
});

describe("community-group-sqlite-store (P3d)", () => {
  it("maps group conversation to sqlite record", () => {
    const record = groupConversationToSqliteRecord(sampleGroup(), "profile-a");
    expect(record).toMatchObject({
      id: "g1",
      profile_id: "profile-a",
      name: "Test Group",
      relay_url: "wss://relay.test",
    });
  });

  it("maps sqlite record back to persisted group seed", () => {
    const record: GroupRecord = {
      id: "g1",
      profile_id: "profile-a",
      name: "From SQLite",
      relay_url: "wss://relay.test",
      kind: "invite-only",
      joined_at: 2_000,
    };
    const persisted = sqliteGroupRecordToPersistedGroup(record, LOCAL);
    expect(persisted.groupId).toBe("g1");
    expect(persisted.displayName).toBe("From SQLite");
    expect(persisted.memberPubkeys).toEqual([LOCAL]);
  });

  it("merges sqlite rows with richer chat-state rows", () => {
    const sqliteSeed = sqliteGroupRecordToPersistedGroup({
      id: "g1",
      profile_id: "profile-a",
      name: "SQLite",
      relay_url: "wss://relay.test",
      kind: "invite-only",
      joined_at: 1_000,
    }, LOCAL);
    const chatStateRow = {
      ...sqliteSeed,
      displayName: "Chat State",
      memberPubkeys: [LOCAL, "b".repeat(64) as PublicKeyHex],
      memberCount: 2,
    };
    const merged = mergePersistedGroupRowsForNativeHydrate([sqliteSeed], [chatStateRow]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.displayName).toBe("Chat State");
    expect(merged[0]?.memberPubkeys).toHaveLength(2);
  });

  it("schedules sqlite upsert when native persistence is required", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    scheduleNativeGroupListSync([sampleGroup()], "profile-a");
    await vi.waitFor(() => {
      expect(dbUpsertGroup).toHaveBeenCalledTimes(1);
    });
  });

  it("skips sqlite sync when native persistence is not required", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(dbUpsertGroup).mockClear();
    scheduleNativeGroupListSync([sampleGroup()], "profile-a");
    expect(dbUpsertGroup).not.toHaveBeenCalled();
  });
});
