import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import {
  buildCommunityInvitePreviewWireMessage,
  resolveCommunityInviteDisplayViewerRole,
  resolveCommunityInviteDisplayViewerRoleFromMessage,
  resolveCommunityInvitePreviewFromSelfForContent,
} from "./community-invite-display-boundary";

const inviterPk = "aa".repeat(32) as PublicKeyHex;
const inviteePk = "bb".repeat(32) as PublicKeyHex;

const inviteContent = (creatorPubkey: PublicKeyHex = inviterPk): string => JSON.stringify({
  type: "community-invite",
  inviteId: "inv-preview-001",
  groupId: "group-test",
  roomKey: "room-key",
  creatorPubkey,
  metadata: { id: "group-test", name: "NewTest 2", access: "invite-only" },
});

const wireMessage = (
  content: string,
  senderPubkey?: PublicKeyHex,
  recipientPubkey?: PublicKeyHex,
): Pick<Message, "senderPubkey" | "recipientPubkey" | "content"> => ({
  content,
  ...(senderPubkey ? { senderPubkey } : {}),
  ...(recipientPubkey ? { recipientPubkey } : {}),
});

describe("community-invite-display-boundary", () => {
  describe("resolveCommunityInviteDisplayViewerRoleFromMessage", () => {
    it("matches thread card role for wire invite", () => {
      const message = wireMessage(inviteContent(), inviterPk, inviteePk);
      expect(resolveCommunityInviteDisplayViewerRoleFromMessage(inviterPk, message)).toBe("inviter");
      expect(resolveCommunityInviteDisplayViewerRoleFromMessage(inviteePk, message)).toBe("invitee");
    });
  });

  describe("buildCommunityInvitePreviewWireMessage", () => {
    it("prefers creatorPubkey over stale lastMessageIsOutgoing for invite preview", () => {
      const wire = buildCommunityInvitePreviewWireMessage(inviteContent(inviterPk), {
        viewerPublicKeyHex: inviteePk,
        peerPublicKeyHex: inviterPk,
        lastMessageIsOutgoing: true,
      });
      expect(wire.senderPubkey).toBe(inviterPk);
      expect(wire.recipientPubkey).toBe(inviteePk);
      expect(resolveCommunityInviteDisplayViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wire,
      })).toBe("invitee");
    });

    it("falls back to conversation direction when creatorPubkey is absent", () => {
      const content = JSON.stringify({
        type: "community-invite",
        inviteId: "inv-preview-002",
        groupId: "group-test",
        roomKey: "room-key",
        metadata: { id: "group-test", name: "NewTest 2" },
      });
      const wire = buildCommunityInvitePreviewWireMessage(content, {
        viewerPublicKeyHex: inviteePk,
        peerPublicKeyHex: inviterPk,
        lastMessageIsOutgoing: false,
      });
      expect(wire.senderPubkey).toBe(inviterPk);
      expect(wire.recipientPubkey).toBe(inviteePk);
    });
  });

  describe("resolveCommunityInvitePreviewFromSelfForContent", () => {
    it("derives preview direction from role authority for invite JSON", () => {
      expect(resolveCommunityInvitePreviewFromSelfForContent(
        inviteContent(inviterPk),
        {
          viewerPublicKeyHex: inviteePk,
          peerPublicKeyHex: inviterPk,
          lastMessageIsOutgoing: true,
        },
        "invite",
      )).toBe(false);
    });
  });
});
