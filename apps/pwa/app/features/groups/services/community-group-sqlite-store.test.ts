import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupRecord } from "@dweb/db";
import {
  groupConversationToSqliteRecord,
  mergePersistedGroupRowsForNativeHydrate,
  syncPersistedGroupsToSqliteFromChatState,
  scheduleNativeGroupListSync,
  sqliteGroupRecordToPersistedGroup,
} from "./community-group-sqlite-store";
import type { GroupConversation } from "@/app/features/messaging/types";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("./workspace-group-persist-port", () => ({
  listWorkspaceGroupRecords: vi.fn(async () => []),
  upsertWorkspaceGroupRecord: vi.fn(async () => undefined),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { upsertWorkspaceGroupRecord } from "./workspace-group-persist-port";

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

describe("community-group-sqlite-store (U2 Wave A)", () => {
  beforeEach(() => {
    vi.mocked(upsertWorkspaceGroupRecord).mockClear();
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
  });

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
    expect(persisted.memberPubkeys).toEqual([]);
    expect(persisted.memberCount).toBe(0);
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

  it("schedules workspace upsert when native persistence is required", async () => {
    scheduleNativeGroupListSync([sampleGroup()], "profile-a");
    await vi.waitFor(() => {
      expect(upsertWorkspaceGroupRecord).toHaveBeenCalledTimes(1);
    });
  });

  it("syncPersistedGroupsToSqliteFromChatState upserts restored group list (B4-2)", async () => {
    const count = await syncPersistedGroupsToSqliteFromChatState([{
      id: "community:g1:wss://relay.test",
      groupId: "g1",
      relayUrl: "wss://relay.test",
      displayName: "Test Group",
      memberPubkeys: [LOCAL],
      lastMessage: "hi",
      unreadCount: 0,
      lastMessageTimeMs: 1_000,
    }], "profile-a");
    expect(count).toBe(1);
    expect(upsertWorkspaceGroupRecord).toHaveBeenCalledWith(expect.objectContaining({
      id: "g1",
      profile_id: "profile-a",
    }));
  });

  it("skips sqlite sync when native persistence is not required", async () => {
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    scheduleNativeGroupListSync([sampleGroup()], "profile-a");
    expect(upsertWorkspaceGroupRecord).not.toHaveBeenCalled();
  });
});
