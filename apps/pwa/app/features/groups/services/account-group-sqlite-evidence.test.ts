import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { accountHasSqliteGroupMessageEvidence } from "./account-group-sqlite-evidence";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/messaging/services/thread-history/workspace-group-message-persist-port", () => ({
  listWorkspaceGroupMessageRecords: vi.fn(async () => []),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { listWorkspaceGroupMessageRecords } from "@/app/features/messaging/services/thread-history/workspace-group-message-persist-port";

const ACCOUNT = "a".repeat(64) as PublicKeyHex;

describe("accountHasSqliteGroupMessageEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(listWorkspaceGroupMessageRecords).mockResolvedValue([]);
  });

  it("returns true when the account authored a sqlite group message", async () => {
    vi.mocked(listWorkspaceGroupMessageRecords).mockResolvedValue([{
      event_id: "evt-1",
      group_id: "group-a",
      profile_id: "default",
      sender_pubkey: ACCOUNT,
      plaintext: "hello",
      created_at: 1,
      received_at: 2,
    }]);

    await expect(accountHasSqliteGroupMessageEvidence({
      profileId: "default",
      groupId: "group-a",
      accountPublicKeyHex: ACCOUNT,
    })).resolves.toBe(true);
  });

  it("returns false when only other senders are present", async () => {
    vi.mocked(listWorkspaceGroupMessageRecords).mockResolvedValue([{
      event_id: "evt-1",
      group_id: "group-a",
      profile_id: "default",
      sender_pubkey: "b".repeat(64),
      plaintext: "hello",
      created_at: 1,
      received_at: 2,
    }]);

    await expect(accountHasSqliteGroupMessageEvidence({
      profileId: "default",
      groupId: "group-a",
      accountPublicKeyHex: ACCOUNT,
    })).resolves.toBe(false);
  });
});
