import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./messaging-client-operations", () => ({
  messagingClientOperations: {
    deleteDmForMe: vi.fn(async () => ["msg-1"]),
  },
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { applyDestructiveDmDeleteForEveryoneLocal } from "./dm-delete-for-everyone-local-destruction";

describe("applyDestructiveDmDeleteForEveryoneLocal", () => {
  beforeEach(() => {
    vi.mocked(emitAccountSyncMutation).mockClear();
  });

  it("emits tombstone mutation only (not dm_history_changed) to avoid relay restore races", async () => {
    await applyDestructiveDmDeleteForEveryoneLocal({
      conversationId: "dm:self:peer",
      messageIdentityIds: ["msg-1"],
      accountPublicKeyHex: "aa".repeat(32),
      profileId: "profile-a",
    });

    expect(emitAccountSyncMutation).toHaveBeenCalledTimes(1);
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("message_delete_tombstones_changed", {
      profileId: "profile-a",
    });
    expect(emitAccountSyncMutation).not.toHaveBeenCalledWith("dm_history_changed");
  });
});
