/**
 * IRA-5 — single display boundary for community invite role + preview direction.
 * Thread cards, message list, and sidebar preview must call this module — not role authority directly.
 *
 * @see docs/program/community-invite-role-ecosystem-design.md
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import {
  parseCommunityInviteWirePayload,
  parseMessageContentJson,
} from "./community-dm-invite-contract";
import {
  resolveCommunityInviteArtifactViewerRole,
  resolveCommunityInviteStatusBannerIsOutgoing,
  type CommunityInviteResponseResolutionStatus,
  type CommunityInviteStatusBannerArtifact,
  type CommunityInviteViewerRole,
  type CommunityInviteWireMessage,
} from "./community-invite-role-authority";

export type CommunityInviteDisplayWireMessage = CommunityInviteWireMessage;

export type ResolveCommunityInviteDisplayViewerRoleParams = Readonly<{
  viewerPublicKeyHex: PublicKeyHex | string | null | undefined;
  message: CommunityInviteDisplayWireMessage;
}>;

export type CommunityInviteConversationPreviewContext = Readonly<{
  peerDisplayName?: string;
  viewerPublicKeyHex?: PublicKeyHex;
  peerPublicKeyHex?: PublicKeyHex;
  /** Legacy conversation summary — topology hint only when wire parties are absent. */
  lastMessageIsOutgoing?: boolean;
  /** @deprecated Alias for lastMessageIsOutgoing — do not use for permissions. */
  isOutgoing?: boolean;
}>;

/** Canonical thread/card/list role — sole UI entry point. */
export const resolveCommunityInviteDisplayViewerRole = (
  params: ResolveCommunityInviteDisplayViewerRoleParams,
): CommunityInviteViewerRole => {
  const viewer = params.viewerPublicKeyHex?.trim();
  if (!viewer) {
    return "observer";
  }
  return resolveCommunityInviteArtifactViewerRole({
    viewerPublicKeyHex: viewer as PublicKeyHex,
    message: params.message,
  });
};

export const resolveCommunityInviteDisplayViewerRoleFromMessage = (
  viewerPublicKeyHex: PublicKeyHex | string | null | undefined,
  message: Pick<Message, "senderPubkey" | "recipientPubkey" | "content">,
): CommunityInviteViewerRole => (
  resolveCommunityInviteDisplayViewerRole({
    viewerPublicKeyHex,
    message,
  })
);

/**
 * Reconstruct wire parties for sidebar preview when only conversation summary exists.
 * Uses viewer + peer topology from lastMessageIsOutgoing when sender/recipient are absent.
 */
export const buildCommunityInvitePreviewWireMessage = (
  content: string,
  context?: CommunityInviteConversationPreviewContext,
): CommunityInviteDisplayWireMessage => {
  const trimmed = content.trim();
  const viewer = context?.viewerPublicKeyHex?.trim();
  const peer = context?.peerPublicKeyHex?.trim();
  const normalizedViewer = viewer ? normalizePublicKeyHex(viewer) : null;
  const normalizedPeer = peer ? normalizePublicKeyHex(peer) : null;
  const outgoingHint = context?.lastMessageIsOutgoing ?? context?.isOutgoing;

  const invite = parseCommunityInviteWirePayload(parseMessageContentJson(trimmed));
  if (invite && normalizedViewer && normalizedPeer) {
    const creator = invite.creatorPubkey ? normalizePublicKeyHex(invite.creatorPubkey) : null;
    if (creator === normalizedViewer) {
      return {
        content: trimmed,
        senderPubkey: normalizedViewer,
        recipientPubkey: normalizedPeer,
      };
    }
    if (creator === normalizedPeer) {
      return {
        content: trimmed,
        senderPubkey: normalizedPeer,
        recipientPubkey: normalizedViewer,
      };
    }
  }

  if (normalizedViewer && normalizedPeer) {
    if (outgoingHint === true) {
      return {
        content: trimmed,
        senderPubkey: normalizedViewer,
        recipientPubkey: normalizedPeer,
      };
    }
    if (outgoingHint === false) {
      return {
        content: trimmed,
        senderPubkey: normalizedPeer,
        recipientPubkey: normalizedViewer,
      };
    }
  }

  return { content: trimmed };
};

/** Preview copy direction — true when the viewing account is the actor (You …). */
export const resolveCommunityInvitePreviewFromSelf = (
  role: CommunityInviteViewerRole,
  artifact: CommunityInviteStatusBannerArtifact,
  responseStatus?: CommunityInviteResponseResolutionStatus,
): boolean => (
  resolveCommunityInviteStatusBannerIsOutgoing(role, artifact, responseStatus)
);

export const resolveCommunityInvitePreviewFromSelfForContent = (
  content: string,
  context: CommunityInviteConversationPreviewContext | undefined,
  artifact: CommunityInviteStatusBannerArtifact,
  responseStatus?: CommunityInviteResponseResolutionStatus,
): boolean | undefined => {
  if (!context?.viewerPublicKeyHex?.trim()) {
    if (context?.isOutgoing === true || context?.lastMessageIsOutgoing === true) {
      return true;
    }
    if (context?.isOutgoing === false || context?.lastMessageIsOutgoing === false) {
      return false;
    }
    return undefined;
  }

  const wireMessage = buildCommunityInvitePreviewWireMessage(content, context);
  const role = resolveCommunityInviteDisplayViewerRole({
    viewerPublicKeyHex: context.viewerPublicKeyHex,
    message: wireMessage,
  });
  return resolveCommunityInvitePreviewFromSelf(role, artifact, responseStatus);
};

export { resolveCommunityInviteStatusBannerIsOutgoing };
