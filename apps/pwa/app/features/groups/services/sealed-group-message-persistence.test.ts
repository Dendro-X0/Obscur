import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  commitSealedGroupMessages,
  loadPersistedSealedGroupMessages,
  persistSealedGroupMessages,
  persistSealedGroupMessagesToSqlite,
} from "./sealed-group-message-persistence";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const CONVERSATION_ID = "community:test8:ws://localhost:7000";
const GROUP_ID = "test8";

const chatStateStoreMocks = vi.hoisted(() => ({
  load: vi.fn(() => null as null | { groupMessages?: Record<string, ReadonlyArray<{ id: string; pubkey: string; created_at: number; content: string }>> }),
  updateGroupMessages: vi.fn(),
  update: vi.fn(),
}));

const nativePolicyMocks = vi.hoisted(() => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  dbGetGroupMessages: vi.fn(async () => []),
  dbInsertGroupMessage: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/messaging/services/chat-state-store", () => ({
  chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: nativePolicyMocks.requiresSqlitePersistence,
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(({ primaryProfileId }: { primaryProfileId: string }) => [primaryProfileId]),
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  readActiveDesktopProfileId: () => "profile-test",
}));

vi.mock("@dweb/db", () => ({
  isTauri: dbMocks.isTauri,
  dbGetGroupMessages: dbMocks.dbGetGroupMessages,
  dbInsertGroupMessage: dbMocks.dbInsertGroupMessage,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("sealed-group-message-persistence", () => {
  beforeEach(() => {
    chatStateStoreMocks.load.mockReset();
    chatStateStoreMocks.updateGroupMessages.mockReset();
    chatStateStoreMocks.update.mockReset();
    chatStateStoreMocks.load.mockReturnValue(null);
    nativePolicyMocks.requiresSqlitePersistence.mockReturnValue(false);
    dbMocks.isTauri.mockReturnValue(false);
    dbMocks.dbGetGroupMessages.mockReset();
    dbMocks.dbGetGroupMessages.mockResolvedValue([]);
    dbMocks.dbInsertGroupMessage.mockReset();
    dbMocks.dbInsertGroupMessage.mockResolvedValue(undefined);
  });

  it("round-trips group messages through chat state per conversation", async () => {
    persistSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      publicKeyHex: PUBLIC_KEY,
      messages: [{
        id: "evt-1",
        pubkey: PUBLIC_KEY,
        created_at: 1_700_000_000,
        content: "hello from B",
      }],
      profileId: "profile-test",
    });

    expect(chatStateStoreMocks.update).toHaveBeenCalledWith(
      PUBLIC_KEY,
      expect.any(Function),
      expect.objectContaining({ debounceMs: 0 }),
    );

    chatStateStoreMocks.load.mockReturnValue({
      groupMessages: {
        [CONVERSATION_ID]: [{
          id: "evt-1",
          pubkey: PUBLIC_KEY,
          created_at: 1_700_000_000,
          content: "hello from B",
        }],
      },
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded).toEqual([{
      id: "evt-1",
      pubkey: PUBLIC_KEY,
      created_at: 1_700_000_000,
      content: "hello from B",
    }]);
  });

  it("merges sqlite rows across account-shared profile slots on native", async () => {
    nativePolicyMocks.requiresSqlitePersistence.mockReturnValue(true);
    dbMocks.isTauri.mockReturnValue(true);
    const { listAccountSharedSqliteProfileIds } = await import("@/app/features/profiles/services/account-shared-sqlite-profile-ids");
    vi.mocked(listAccountSharedSqliteProfileIds).mockReturnValue(["default", "profile-secondary"]);
    dbMocks.dbGetGroupMessages.mockImplementation(async (profileId: string) => {
      if (profileId === "default") {
        return [{
          event_id: "evt-default",
          group_id: GROUP_ID,
          profile_id: profileId,
          sender_pubkey: PUBLIC_KEY,
          plaintext: "from default slot",
          created_at: 1_700_000_000_000,
          received_at: 1_700_000_000_000,
        }];
      }
      return [{
        event_id: "evt-secondary",
        group_id: GROUP_ID,
        profile_id: profileId,
        sender_pubkey: "b".repeat(64),
        plaintext: "from secondary slot",
        created_at: 1_700_000_001_000,
        received_at: 1_700_000_001_000,
      }];
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "default",
    });

    expect(loaded).toHaveLength(2);
    expect(loaded.map((row) => row.id).sort()).toEqual(["evt-default", "evt-secondary"]);
  });

  it("falls back to chat state when native sqlite is empty", async () => {
    nativePolicyMocks.requiresSqlitePersistence.mockReturnValue(true);
    dbMocks.isTauri.mockReturnValue(true);
    dbMocks.dbGetGroupMessages.mockResolvedValue([]);

    chatStateStoreMocks.load.mockReturnValue({
      groupMessages: {
        [CONVERSATION_ID]: [{
          id: "evt-chat",
          pubkey: PUBLIC_KEY,
          created_at: 1_700_000_001,
          content: "seed from chat state",
        }],
      },
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded).toEqual([{
      id: "evt-chat",
      pubkey: PUBLIC_KEY,
      created_at: 1_700_000_001,
      content: "seed from chat state",
    }]);
  });

  it("persists outgoing messages to sqlite on native desktop", async () => {
    dbMocks.isTauri.mockReturnValue(true);

    await persistSealedGroupMessagesToSqlite({
      groupId: GROUP_ID,
      profileId: "profile-test",
      messages: [{
        id: "evt-out",
        pubkey: PUBLIC_KEY,
        created_at: 1_700_000_002,
        content: "hello from A",
      }],
    });

    expect(dbMocks.dbInsertGroupMessage).toHaveBeenCalledWith({
      event_id: "evt-out",
      group_id: GROUP_ID,
      profile_id: "profile-test",
      sender_pubkey: PUBLIC_KEY,
      plaintext: "hello from A",
      created_at: 1_700_000_002_000,
      received_at: expect.any(Number),
    });
  });

  it("commitSealedGroupMessages writes sqlite and chat-state mirror on native", async () => {
    dbMocks.isTauri.mockReturnValue(true);
    nativePolicyMocks.requiresSqlitePersistence.mockReturnValue(true);

    await commitSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
      messages: [{
        id: "evt-canonical",
        pubkey: PUBLIC_KEY,
        created_at: 1_700_000_003,
        content: "canonical outbound",
      }],
    });

    expect(dbMocks.dbInsertGroupMessage).toHaveBeenCalledTimes(1);
    expect(chatStateStoreMocks.update).toHaveBeenCalledWith(
      PUBLIC_KEY,
      expect.any(Function),
      expect.objectContaining({ debounceMs: 0 }),
    );
  });

  it("merges sqlite and chat-state rows on native cold-load", async () => {
    dbMocks.isTauri.mockReturnValue(true);
    dbMocks.dbGetGroupMessages.mockResolvedValue([{
      event_id: "evt-sqlite",
      group_id: GROUP_ID,
      profile_id: "profile-test",
      sender_pubkey: PUBLIC_KEY,
      plaintext: "from sqlite",
      created_at: 1_700_000_005_000,
      received_at: 1_700_000_005_000,
    }]);
    chatStateStoreMocks.load.mockReturnValue({
      groupMessages: {
        [CONVERSATION_ID]: [{
          id: "evt-chat",
          pubkey: PUBLIC_KEY,
          created_at: 1_700_000_006,
          content: "from chat state",
        }],
      },
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      relayUrl: "ws://localhost:7000",
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded.map((row) => row.id).sort()).toEqual(["evt-chat", "evt-sqlite"]);
  });

  it("P5-COM-MSG: sqlite commit survives simulated cold start without chat-state mirror", async () => {
    dbMocks.isTauri.mockReturnValue(true);
    nativePolicyMocks.requiresSqlitePersistence.mockReturnValue(true);
    chatStateStoreMocks.load.mockReturnValue(null);

    await commitSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
      messages: [{
        id: "evt-cold",
        pubkey: PUBLIC_KEY,
        created_at: 1_700_000_010,
        content: "survives cold restart",
      }],
    });

    expect(dbMocks.dbInsertGroupMessage).toHaveBeenCalledTimes(1);

    dbMocks.dbGetGroupMessages.mockResolvedValue([{
      event_id: "evt-cold",
      group_id: GROUP_ID,
      profile_id: "profile-test",
      sender_pubkey: PUBLIC_KEY,
      plaintext: "survives cold restart",
      created_at: 1_700_000_010_000,
      received_at: 1_700_000_010_000,
    }]);

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: CONVERSATION_ID,
      groupId: GROUP_ID,
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded).toEqual([{
      id: "evt-cold",
      pubkey: PUBLIC_KEY,
      created_at: 1_700_000_010,
      content: "survives cold restart",
    }]);
  });

  it("loads chat-state rows stored under legacy conversation id aliases", async () => {
    const legacyConversationId = "group:test8@ws://localhost:7000";
    chatStateStoreMocks.load.mockReturnValue({
      groupMessages: {
        [legacyConversationId]: [{
          id: "evt-legacy",
          pubkey: PUBLIC_KEY,
          created_at: 1_700_000_004,
          content: "stored under legacy alias",
        }],
      },
    });

    const loaded = await loadPersistedSealedGroupMessages({
      conversationId: "community:v2_deadbeef",
      groupId: GROUP_ID,
      relayUrl: "ws://localhost:7000",
      communityId: "v2_deadbeef",
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-test",
    });

    expect(loaded).toEqual([{
      id: "evt-legacy",
      pubkey: PUBLIC_KEY,
      created_at: 1_700_000_004,
      content: "stored under legacy alias",
    }]);
  });
});
