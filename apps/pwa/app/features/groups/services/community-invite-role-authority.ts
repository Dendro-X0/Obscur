/**
 * IRA-1 — canonical community invite role authority.
 * Wire sender/recipient/payload only — never message.isOutgoing or ledger direction.
 *
 * @see docs/program/community-invite-role-ecosystem-design.md
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  parseCommunityInviteResponseWirePayload,
  parseCommunityInviteWirePayload,
  parseMessageContentJson,
} from "./community-dm-invite-contract";

export type CommunityInviteViewerRole = "inviter" | "invitee" | "observer";

export type CommunityInviteWireMessage = Pick<Message, "senderPubkey" | "recipientPubkey" | "content">;

export type ResolveCommunityInviteViewerRoleParams = Readonly<{
  viewerPublicKeyHex: PublicKeyHex;
  message: CommunityInviteWireMessage;
}>;

export type CommunityInviteAction = "accept" | "decline" | "cancel";

export type CommunityInviteStatusBannerArtifact = "invite" | "response";

export type CommunityInviteResponseResolutionStatus = "accepted" | "declined" | "canceled";

const normalizeViewerKey = (value: PublicKeyHex | string): PublicKeyHex | null => (
  normalizePublicKeyHex(value)
);

const keysMatch = (
  left: PublicKeyHex | string | null | undefined,
  right: PublicKeyHex | string | null | undefined,
): boolean => {
  const normalizedLeft = normalizePublicKeyHex(typeof left === "string" ? left : null);
  const normalizedRight = normalizePublicKeyHex(typeof right === "string" ? right : null);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

/** Bubble alignment — derived from wire sender, not sqlite isOutgoing. */
export const resolveDmBubbleIsOutgoing = (
  viewerPublicKeyHex: PublicKeyHex,
  message: Pick<Message, "senderPubkey">,
): boolean => keysMatch(message.senderPubkey, viewerPublicKeyHex);

/** Active/historical invite card role for the viewing account. */
export const resolveCommunityInviteViewerRole = (
  params: ResolveCommunityInviteViewerRoleParams,
): CommunityInviteViewerRole => {
  const viewer = normalizeViewerKey(params.viewerPublicKeyHex);
  if (!viewer) {
    return "observer";
  }

  const invite = parseCommunityInviteWirePayload(parseMessageContentJson(params.message.content ?? ""));
  if (!invite) {
    return "observer";
  }

  const sender = params.message.senderPubkey;
  const recipient = params.message.recipientPubkey;
  const senderPresent = Boolean(normalizePublicKeyHex(sender));

  if (keysMatch(sender, viewer)) {
    return "inviter";
  }

  if (keysMatch(recipient, viewer)) {
    return "invitee";
  }

  if (!senderPresent && keysMatch(invite.creatorPubkey, viewer)) {
    logAppEvent({
      name: "community.invite_role_legacy_creator_without_sender",
      level: "warn",
      scope: { feature: "groups", action: "invite_role_authority" },
      context: {
        inviteId: invite.inviteId,
        groupId: invite.groupId,
      },
    });
    return "inviter";
  }

  return "observer";
};

/** Terminal invite-response card role for the viewing account. */
export const resolveCommunityInviteResponseViewerRole = (
  params: ResolveCommunityInviteViewerRoleParams,
): CommunityInviteViewerRole => {
  const viewer = normalizeViewerKey(params.viewerPublicKeyHex);
  if (!viewer) {
    return "observer";
  }

  const response = parseCommunityInviteResponseWirePayload(parseMessageContentJson(params.message.content ?? ""));
  if (!response) {
    return "observer";
  }

  if (keysMatch(params.message.senderPubkey, viewer)) {
    return response.status === "canceled" ? "inviter" : "invitee";
  }

  if (keysMatch(params.message.recipientPubkey, viewer)) {
    return response.status === "canceled" ? "invitee" : "inviter";
  }

  return "observer";
};

export const isCommunityInviteActionPermitted = (
  role: CommunityInviteViewerRole,
  action: CommunityInviteAction,
): boolean => {
  if (action === "cancel") {
    return role === "inviter";
  }
  return role === "invitee";
};

/** Status banner copy alignment — independent of sqlite isOutgoing. */
export const resolveCommunityInviteStatusBannerIsOutgoing = (
  role: CommunityInviteViewerRole,
  artifact: CommunityInviteStatusBannerArtifact,
  responseStatus?: CommunityInviteResponseResolutionStatus,
): boolean => {
  if (artifact === "invite") {
    return role === "inviter";
  }
  if (responseStatus === "canceled") {
    return role === "inviter";
  }
  return role === "invitee";
};

/** Unified entry for thread renderers — dispatches by payload type. */
export const resolveCommunityInviteArtifactViewerRole = (
  params: ResolveCommunityInviteViewerRoleParams,
): CommunityInviteViewerRole => {
  const content = params.message.content?.trim() ?? "";
  if (!content) {
    return "observer";
  }
  const parsed = parseMessageContentJson(content);
  if (parsed && typeof parsed === "object" && (parsed as { type?: unknown }).type === "community-invite-response") {
    return resolveCommunityInviteResponseViewerRole(params);
  }
  return resolveCommunityInviteViewerRole(params);
};
