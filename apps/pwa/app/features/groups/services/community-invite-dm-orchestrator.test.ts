import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";

const pipelineMocks = vi.hoisted(() => ({
  commitOutboundCommunityDmInvite: vi.fn(async (params: { dmMessage: Message }) => params.dmMessage),
  parseInvitePayloadFromMessageContent: vi.fn((content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }),
}));

vi.mock("./community-dm-invite-pipeline", () => pipelineMocks);

import { commitOutgoingCommunityInviteDm } from "./community-invite-dm-orchestrator";

const sender = "a".repeat(64) as PublicKeyHex;
const recipient = "b".repeat(64) as PublicKeyHex;

const createInviteMessage = (): Message => ({
  id: "gift-wrap-id",
  eventId: "rumor-id",
  relayPublishedEventId: "gift-wrap-id",
  conversationId: `${sender}:${recipient}`,
  kind: "user",
  content: JSON.stringify({
    type: "community-invite",
    inviteId: "invite-test-1",
    groupId: "group-1",
    roomKey: "room-key",
    metadata: { name: "GroupTest 1", about: "About", access: "private" },
  }),
  timestamp: new Date("2026-05-25T12:00:00.000Z"),
  isOutgoing: true,
  status: "delivered",
  senderPubkey: sender,
  recipientPubkey: recipient,
});

describe("commitOutgoingCommunityInviteDm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to the unified community DM invite pipeline", async () => {
    const inviteMessage = createInviteMessage();
    const canonical = await commitOutgoingCommunityInviteDm({
      inviteMessage,
      accountPublicKeyHex: sender,
      profileId: "default",
    });

    expect(canonical.id).toBe("gift-wrap-id");
    expect(pipelineMocks.commitOutboundCommunityDmInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteId: "invite-test-1",
        dmMessage: inviteMessage,
        accountPublicKeyHex: sender,
        profileId: "default",
      }),
    );
  });
});
