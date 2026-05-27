import { describe, expect, it } from "vitest";
import { buildCommunityInvitePlaintext, buildOutgoingCommunityInviteDmMessage } from "./community-invite-dm-message";
import {
  parseCommunityInviteWirePayload,
  type CommunityDmInviteId,
} from "../services/community-dm-invite-contract";

describe("community-invite-dm-message", () => {
  it("includes stable inviteId on invite wire plaintext", () => {
    const inviteId = "11111111-1111-4111-8111-111111111111" as CommunityDmInviteId;
    const plaintext = buildCommunityInvitePlaintext({
      groupId: "group-1",
      roomKeyHex: "room-key-hex",
      inviteId,
      metadata: { id: "group-1", name: "Test Group", access: "invite-only" },
    });
    const parsed = parseCommunityInviteWirePayload(JSON.parse(plaintext));
    expect(parsed?.inviteId).toBe(inviteId);
  });

  it("builds outgoing invite rows with inviteId in content", () => {
    const inviteId = "22222222-2222-4222-8222-222222222222" as CommunityDmInviteId;
    const message = buildOutgoingCommunityInviteDmMessage({
      giftWrapEventId: "gift-wrap-id",
      canonicalRumorEventId: "rumor-id",
      conversationId: "a:b",
      myPublicKeyHex: "a".repeat(64) as never,
      recipientPubkey: "b".repeat(64) as never,
      groupId: "group-1",
      roomKeyHex: "room-key-hex",
      inviteId,
      metadata: { id: "group-1", name: "Test Group", access: "invite-only" },
    });
    const parsed = parseCommunityInviteWirePayload(JSON.parse(message.content));
    expect(parsed?.inviteId).toBe(inviteId);
  });
});
