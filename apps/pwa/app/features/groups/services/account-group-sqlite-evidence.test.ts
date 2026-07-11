import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { accountHasSqliteGroupMessageEvidence } from "./account-group-sqlite-evidence";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  dbGetGroupMessages: vi.fn(async () => []),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { dbGetGroupMessages } from "@dweb/db";

const ACCOUNT = "a".repeat(64) as PublicKeyHex;

describe("accountHasSqliteGroupMessageEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(dbGetGroupMessages).mockResolvedValue([]);
  });

  it("returns true when the account authored a sqlite group message", async () => {
    vi.mocked(dbGetGroupMessages).mockResolvedValue([{
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
    vi.mocked(dbGetGroupMessages).mockResolvedValue([{
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
