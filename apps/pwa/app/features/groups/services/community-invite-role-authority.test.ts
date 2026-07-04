import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import {
  isCommunityInviteActionPermitted,
  resolveCommunityInviteArtifactViewerRole,
  resolveCommunityInviteResponseViewerRole,
  resolveCommunityInviteStatusBannerIsOutgoing,
  resolveCommunityInviteViewerRole,
  resolveDmBubbleIsOutgoing,
} from "./community-invite-role-authority";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

const inviterPk = "aa".repeat(32) as PublicKeyHex;
const inviteePk = "bb".repeat(32) as PublicKeyHex;
const strangerPk = "cc".repeat(32) as PublicKeyHex;
const inviteId = "inv-test-001" as CommunityDmInviteId;

const inviteContent = (overrides: Record<string, unknown> = {}): string => JSON.stringify({
  type: "community-invite",
  inviteId,
  groupId: "group-newtest-2",
  roomKey: "room-key-hex",
  metadata: { id: "group-newtest-2", name: "NewTest 2", access: "invite-only" },
  creatorPubkey: inviterPk,
  ...overrides,
});

const responseContent = (status: "accepted" | "declined" | "canceled"): string => JSON.stringify({
  type: "community-invite-response",
  inviteId,
  status,
  groupId: "group-newtest-2",
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

describe("community-invite-role-authority", () => {
  describe("resolveCommunityInviteViewerRole", () => {
    it("marks wire sender as inviter", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviterPk,
        message: wireMessage(inviteContent(), inviterPk, inviteePk),
      })).toBe("inviter");
    });

    it("marks wire recipient as invitee", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(inviteContent(), inviterPk, inviteePk),
      })).toBe("invitee");
    });

    it("returns observer for unrelated viewer", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: strangerPk,
        message: wireMessage(inviteContent(), inviterPk, inviteePk),
      })).toBe("observer");
    });

    it("returns observer when payload is not an invite", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(JSON.stringify({ type: "other" }), inviterPk, inviteePk),
      })).toBe("observer");
    });

    it("uses creatorPubkey for legacy rows missing sender", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviterPk,
        message: wireMessage(inviteContent(), undefined, inviteePk),
      })).toBe("inviter");
    });

    it("prefers sender over creator when both present", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(inviteContent({ creatorPubkey: inviterPk }), inviterPk, inviteePk),
      })).toBe("invitee");
    });

    it("ignores isOutgoing — recipient stays invitee even when flag says outgoing", () => {
      expect(resolveCommunityInviteViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: {
          ...wireMessage(inviteContent(), inviterPk, inviteePk),
          isOutgoing: true,
        } as never,
      })).toBe("invitee");
    });
  });

  describe("resolveCommunityInviteResponseViewerRole", () => {
    it("marks invitee sender on accept", () => {
      expect(resolveCommunityInviteResponseViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(responseContent("accepted"), inviteePk, inviterPk),
      })).toBe("invitee");
    });

    it("marks inviter recipient on accept", () => {
      expect(resolveCommunityInviteResponseViewerRole({
        viewerPublicKeyHex: inviterPk,
        message: wireMessage(responseContent("accepted"), inviteePk, inviterPk),
      })).toBe("inviter");
    });

    it("marks inviter sender on cancel", () => {
      expect(resolveCommunityInviteResponseViewerRole({
        viewerPublicKeyHex: inviterPk,
        message: wireMessage(responseContent("canceled"), inviterPk, inviteePk),
      })).toBe("inviter");
    });

    it("marks invitee recipient on cancel", () => {
      expect(resolveCommunityInviteResponseViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(responseContent("canceled"), inviterPk, inviteePk),
      })).toBe("invitee");
    });
  });

  describe("resolveCommunityInviteArtifactViewerRole", () => {
    it("dispatches invite payloads to invite resolver", () => {
      expect(resolveCommunityInviteArtifactViewerRole({
        viewerPublicKeyHex: inviteePk,
        message: wireMessage(inviteContent(), inviterPk, inviteePk),
      })).toBe("invitee");
    });

    it("dispatches response payloads to response resolver", () => {
      expect(resolveCommunityInviteArtifactViewerRole({
        viewerPublicKeyHex: inviterPk,
        message: wireMessage(responseContent("declined"), inviteePk, inviterPk),
      })).toBe("inviter");
    });
  });

  describe("isCommunityInviteActionPermitted", () => {
    it("permits accept and decline for invitee only", () => {
      expect(isCommunityInviteActionPermitted("invitee", "accept")).toBe(true);
      expect(isCommunityInviteActionPermitted("invitee", "decline")).toBe(true);
      expect(isCommunityInviteActionPermitted("inviter", "accept")).toBe(false);
      expect(isCommunityInviteActionPermitted("observer", "accept")).toBe(false);
    });

    it("permits cancel for inviter only", () => {
      expect(isCommunityInviteActionPermitted("inviter", "cancel")).toBe(true);
      expect(isCommunityInviteActionPermitted("invitee", "cancel")).toBe(false);
      expect(isCommunityInviteActionPermitted("observer", "cancel")).toBe(false);
    });
  });

  describe("resolveCommunityInviteStatusBannerIsOutgoing", () => {
    it("maps invite artifact from inviter role", () => {
      expect(resolveCommunityInviteStatusBannerIsOutgoing("inviter", "invite")).toBe(true);
      expect(resolveCommunityInviteStatusBannerIsOutgoing("invitee", "invite")).toBe(false);
    });

    it("maps response artifact from actor role", () => {
      expect(resolveCommunityInviteStatusBannerIsOutgoing("invitee", "response", "accepted")).toBe(true);
      expect(resolveCommunityInviteStatusBannerIsOutgoing("inviter", "response", "accepted")).toBe(false);
      expect(resolveCommunityInviteStatusBannerIsOutgoing("inviter", "response", "canceled")).toBe(true);
      expect(resolveCommunityInviteStatusBannerIsOutgoing("invitee", "response", "canceled")).toBe(false);
    });
  });

  describe("resolveDmBubbleIsOutgoing", () => {
    it("returns true only when viewer is wire sender", () => {
      expect(resolveDmBubbleIsOutgoing(inviterPk, { senderPubkey: inviterPk })).toBe(true);
      expect(resolveDmBubbleIsOutgoing(inviteePk, { senderPubkey: inviterPk })).toBe(false);
      expect(resolveDmBubbleIsOutgoing(inviterPk, {})).toBe(false);
    });
  });

  describe("regression matrix — reported split-brain scenario", () => {
    it("inviter sees inviter role; invitee sees invitee role on same wire invite", () => {
      const message = wireMessage(inviteContent(), inviterPk, inviteePk);
      expect(resolveCommunityInviteViewerRole({ viewerPublicKeyHex: inviterPk, message })).toBe("inviter");
      expect(resolveCommunityInviteViewerRole({ viewerPublicKeyHex: inviteePk, message })).toBe("invitee");
      expect(isCommunityInviteActionPermitted("inviter", "cancel")).toBe(true);
      expect(isCommunityInviteActionPermitted("invitee", "accept")).toBe(true);
      expect(isCommunityInviteActionPermitted("invitee", "cancel")).toBe(false);
    });
  });
});
