import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  applyNativeRestoreSqliteMaterialization,
  applyNativeSqliteBackupEvidence,
  collectNativeSqliteBackupEvidence,
  mergeNativeSqliteBackupEvidence,
  parseNativeSqliteBackupEvidence,
} from "./native-sqlite-backup-evidence";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@obscur/dm-engine", () => ({
  listDmConversations: vi.fn(async () => [{
    id: "dm:aa:bb",
    profile_id: "profile-a",
    peer_pubkey: "b".repeat(64),
    last_event_id: null,
    last_message_at: 1000,
    last_plaintext_preview: null,
    unread_count: 0,
  }]),
  fetchDmThreadRows: vi.fn(async () => [{
    event_id: "evt-dm",
    profile_id: "profile-a",
    conversation_id: "dm:aa:bb",
    sender_pubkey: "b".repeat(64),
    recipient_pubkey: "a".repeat(64),
    plaintext: "hello sqlite",
    kind: 0,
    created_at: 1000,
    received_at: 1000,
    is_outgoing: false,
    reply_to_event_id: null,
    has_attachment: false,
  }]),
}));

vi.mock("@obscur/workspace-engine", () => ({
  listWorkspaceGroups: vi.fn(async () => [{
    id: "g1",
    profile_id: "profile-a",
    name: "Group",
    relay_url: "wss://relay.test",
    kind: "invite-only",
    joined_at: 1000,
  }]),
  listWorkspaceGroupMessages: vi.fn(async () => [{
    event_id: "evt-group",
    group_id: "g1",
    profile_id: "profile-a",
    sender_pubkey: "b".repeat(64),
    plaintext: "group body",
    created_at: 1000,
    received_at: 1000,
  }]),
  upsertWorkspaceGroup: vi.fn(async () => undefined),
  insertWorkspaceGroupMessage: vi.fn(async () => undefined),
}));

vi.mock("@obscur/engine-host/tauri", () => ({
  createTauriEngineHost: vi.fn(() => ({ invoke: vi.fn() })),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@/app/features/dm-kernel/dm-kernel-write-port", () => ({
  writeDmKernelMessage: vi.fn(async () => ({ ok: true, reason: "insert_ok", errorMessage: null })),
}));

vi.mock("@/app/features/profiles/services/account-shared-sqlite-profile-ids", () => ({
  listAccountSharedSqliteProfileIds: vi.fn(({ primaryProfileId }: { primaryProfileId: string }) => [primaryProfileId]),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-a"),
}));

vi.mock("@/app/features/groups/services/community-group-sqlite-store", () => ({
  syncPersistedGroupsToSqliteFromChatState: vi.fn(async () => 1),
}));

import {
  insertWorkspaceGroupMessage,
  upsertWorkspaceGroup,
} from "@obscur/workspace-engine";
import { writeDmKernelMessage } from "@/app/features/dm-kernel/dm-kernel-write-port";
import { syncPersistedGroupsToSqliteFromChatState } from "@/app/features/groups/services/community-group-sqlite-store";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;

describe("native-sqlite-backup-evidence (Path B B4 / U2 Wave C)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collectNativeSqliteBackupEvidence gathers dm and group sqlite rows (B4-1)", async () => {
    const evidence = await collectNativeSqliteBackupEvidence({
      publicKeyHex: PUBLIC_KEY,
      profileId: "profile-a",
    });

    expect(evidence?.dmMessages).toHaveLength(1);
    expect(evidence?.groupMessages).toHaveLength(1);
    expect(evidence?.groupRecords).toHaveLength(1);
  });

  it("parseNativeSqliteBackupEvidence validates snapshot shape", () => {
    const parsed = parseNativeSqliteBackupEvidence({
      collectedAtUnixMs: 1,
      primaryProfileId: "profile-a",
      dmMessages: [],
      groupMessages: [{
        event_id: "evt-group",
        group_id: "g1",
        profile_id: "profile-a",
        sender_pubkey: "b".repeat(64),
        plaintext: "group body",
        created_at: 1000,
        received_at: 1000,
      }],
      groupRecords: [],
    });
    expect(parsed?.groupMessages).toHaveLength(1);
  });

  it("mergeNativeSqliteBackupEvidence dedupes by event id", () => {
    const merged = mergeNativeSqliteBackupEvidence(
      {
        collectedAtUnixMs: 1,
        primaryProfileId: "profile-a",
        dmMessages: [{
          event_id: "evt-dm",
          profile_id: "profile-a",
          conversation_id: "dm:aa:bb",
          sender_pubkey: "b".repeat(64),
          recipient_pubkey: "a".repeat(64),
          plaintext: "old",
          kind: 0,
          created_at: 900,
          received_at: 900,
          is_outgoing: false,
          reply_to_event_id: null,
          has_attachment: false,
        }],
        groupMessages: [],
        groupRecords: [],
      },
      {
        collectedAtUnixMs: 2,
        primaryProfileId: "profile-a",
        dmMessages: [{
          event_id: "evt-dm",
          profile_id: "profile-a",
          conversation_id: "dm:aa:bb",
          sender_pubkey: "b".repeat(64),
          recipient_pubkey: "a".repeat(64),
          plaintext: "new",
          kind: 0,
          created_at: 1000,
          received_at: 1000,
          is_outgoing: false,
          reply_to_event_id: null,
          has_attachment: false,
        }],
        groupMessages: [],
        groupRecords: [],
      },
    );
    expect(merged?.dmMessages[0]?.plaintext).toBe("new");
  });

  it("applyNativeSqliteBackupEvidence writes rows to target profile slot", async () => {
    await applyNativeSqliteBackupEvidence({
      profileId: "profile-restore",
      evidence: {
        collectedAtUnixMs: 1,
        primaryProfileId: "profile-a",
        dmMessages: [{
          event_id: "evt-dm",
          profile_id: "profile-a",
          conversation_id: "dm:aa:bb",
          sender_pubkey: "b".repeat(64),
          recipient_pubkey: "a".repeat(64),
          plaintext: "hello sqlite",
          kind: 0,
          created_at: 1000,
          received_at: 1000,
          is_outgoing: false,
          reply_to_event_id: null,
          has_attachment: false,
        }],
        groupMessages: [{
          event_id: "evt-group",
          group_id: "g1",
          profile_id: "profile-a",
          sender_pubkey: "b".repeat(64),
          plaintext: "group body",
          created_at: 1000,
          received_at: 1000,
        }],
        groupRecords: [{
          id: "g1",
          profile_id: "profile-a",
          name: "Group",
          relay_url: "wss://relay.test",
          kind: "invite-only",
          joined_at: 1000,
        }],
      },
    });

    expect(upsertWorkspaceGroup).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "profile-restore",
      group: expect.objectContaining({ profile_id: "profile-restore" }),
    }));
    expect(writeDmKernelMessage).toHaveBeenCalledWith(expect.objectContaining({ profile_id: "profile-restore" }));
    expect(insertWorkspaceGroupMessage).toHaveBeenCalledWith(expect.objectContaining({
      profileId: "profile-restore",
      message: expect.objectContaining({ profile_id: "profile-restore" }),
    }));
  });

  it("applyNativeRestoreSqliteMaterialization syncs group list and sqlite evidence (B4-2)", async () => {
    await applyNativeRestoreSqliteMaterialization({
      profileId: "profile-restore",
      chatState: {
        version: 2,
        createdConnections: [],
        createdGroups: [{
          id: "community:g1:wss://relay.test",
          groupId: "g1",
          relayUrl: "wss://relay.test",
          displayName: "Group",
          memberPubkeys: [PUBLIC_KEY],
          lastMessage: "",
          unreadCount: 0,
          lastMessageTimeMs: 1000,
        }],
        unreadByConversationId: {},
        connectionOverridesByConnectionId: {},
        messagesByConversationId: {},
        groupMessages: {},
        connectionRequests: [],
        pinnedChatIds: [],
        hiddenChatIds: [],
      },
      nativeSqliteEvidence: {
        collectedAtUnixMs: 1,
        primaryProfileId: "profile-a",
        dmMessages: [],
        groupMessages: [{
          event_id: "evt-group",
          group_id: "g1",
          profile_id: "profile-a",
          sender_pubkey: "b".repeat(64),
          plaintext: "group body",
          created_at: 1000,
          received_at: 1000,
        }],
        groupRecords: [],
      },
    });

    expect(syncPersistedGroupsToSqliteFromChatState).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ groupId: "g1" })]),
      "profile-restore",
    );
    expect(insertWorkspaceGroupMessage).toHaveBeenCalled();
  });
});
