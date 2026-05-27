import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  dbInsertMessage: vi.fn(async () => undefined),
}));

vi.mock("@dweb/db", () => dbMocks);

const chatStateMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));

vi.mock("./chat-state-store", () => ({
  chatStateStoreService: chatStateMocks,
}));

import { loadNativeOutgoingCommunityInviteRepairMessages } from "./dm-conversation-native-invite-repair";

const myPk = "a".repeat(64) as PublicKeyHex;
const peerPk = "b".repeat(64) as PublicKeyHex;
const conversationId = `${myPk}:${peerPk}`;

describe("loadNativeOutgoingCommunityInviteRepairMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.isTauri.mockReturnValue(true);
  });

  it("repairs outgoing community invites from profile-scoped chat-state into canonical messages", () => {
    const inviteContent = JSON.stringify({
      type: "community-invite",
      groupId: "group-1",
      roomKey: "key",
      metadata: { name: "GroupTset 1" },
    });
    chatStateMocks.load.mockReturnValue({
      messagesByConversationId: {
        [conversationId]: [{
          id: "gift-wrap-id",
          eventId: "rumor-id",
          content: inviteContent,
          timestampMs: 1_700_000_000_000,
          isOutgoing: true,
          pubkey: myPk,
        }],
      },
    });

    const repaired = loadNativeOutgoingCommunityInviteRepairMessages({
      conversationIds: [conversationId],
      myPublicKeyHex: myPk,
      profileId: "default",
    });

    expect(repaired).toHaveLength(1);
    expect(repaired[0]?.id).toBe("rumor-id");
    expect(repaired[0]?.eventId).toBe("rumor-id");
    expect(dbMocks.dbInsertMessage).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: "rumor-id" }),
    );
  });

  it("returns empty on web", () => {
    dbMocks.isTauri.mockReturnValue(false);
    const repaired = loadNativeOutgoingCommunityInviteRepairMessages({
      conversationIds: [conversationId],
      myPublicKeyHex: myPk,
      profileId: "default",
    });
    expect(repaired).toEqual([]);
  });
});
