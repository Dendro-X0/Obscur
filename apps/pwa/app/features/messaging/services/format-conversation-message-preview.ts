import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import {
  resolveCommunityInvitePreviewFromSelfForContent,
  type CommunityInviteConversationPreviewContext,
} from "@/app/features/groups/services/community-invite-display-boundary";
import { stripVoiceCallControlPreview } from "./realtime-voice-signaling";

/** @deprecated Legacy sidebar copy — remapped when {@link ConversationPreviewContext} is available. */
export const COMMUNITY_INVITE_LIST_PREVIEW = "Community invitation";
/** @deprecated Legacy sidebar copy — remapped when {@link ConversationPreviewContext} is available. */
export const COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW = "Accepted community invite";
/** @deprecated Legacy sidebar copy — remapped when {@link ConversationPreviewContext} is available. */
export const COMMUNITY_INVITE_RESPONSE_DECLINED_PREVIEW = "Declined community invite";
/** @deprecated Legacy sidebar copy — remapped when {@link ConversationPreviewContext} is available. */
export const COMMUNITY_INVITE_RESPONSE_CANCELED_PREVIEW = "Community invite withdrawn";
/** @deprecated Legacy sidebar copy — remapped when {@link ConversationPreviewContext} is available. */
export const COMMUNITY_INVITE_RESPONSE_GENERIC_PREVIEW = "Community invite update";

export type ConversationPreviewContext = CommunityInviteConversationPreviewContext;

const PREVIEW_MAX_LENGTH = 140;

const truncatePreview = (value: string): string => {
  if (value.length <= PREVIEW_MAX_LENGTH) {
    return value;
  }
  return `${value.slice(0, PREVIEW_MAX_LENGTH)}...`;
};

const peerLabel = (context?: ConversationPreviewContext): string => {
  const name = context?.peerDisplayName?.trim();
  if (!name || name === "Unknown contact") {
    return "Someone";
  }
  return name;
};

const readInvitePreview = (
  metadataName: string | undefined,
  fromSelf: boolean | undefined,
  context?: ConversationPreviewContext,
): string => {
  const communityName = metadataName?.trim();
  if (fromSelf === true) {
    return communityName
      ? `You sent an invitation to ${communityName}`
      : "You sent an invitation";
  }
  return communityName
    ? `${peerLabel(context)} invited you to ${communityName}`
    : `${peerLabel(context)} sent you an invitation`;
};

const readInviteResponsePreview = (
  status: unknown,
  fromSelf: boolean | undefined,
  context?: ConversationPreviewContext,
): string => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  const fromPeer = fromSelf === false;

  if (normalized === "accepted") {
    if (fromSelf === true) {
      return "You accepted the invitation";
    }
    if (fromPeer) {
      return `${peerLabel(context)} accepted the invitation`;
    }
    return "Invitation accepted";
  }
  if (normalized === "declined" || normalized === "rejected") {
    if (fromSelf === true) {
      return "You declined the invitation";
    }
    if (fromPeer) {
      return `${peerLabel(context)} declined the invitation`;
    }
    return "Invitation declined";
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    if (fromSelf === true) {
      return "You withdrew the invitation";
    }
    if (fromPeer) {
      return `${peerLabel(context)} withdrew the invitation`;
    }
    return "Invitation withdrawn";
  }
  return "Invitation updated";
};

const remapLegacyInvitePreview = (
  normalized: string,
  context?: ConversationPreviewContext,
): string | null => {
  if (normalized === COMMUNITY_INVITE_LIST_PREVIEW || normalized.startsWith("Community invite:")) {
    const legacyName = normalized.startsWith("Community invite:")
      ? normalized.slice("Community invite:".length).trim()
      : undefined;
    const fromSelf = resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "invite");
    return readInvitePreview(legacyName, fromSelf, context);
  }
  if (normalized === COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW) {
    return readInviteResponsePreview(
      "accepted",
      resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "response", "accepted"),
      context,
    );
  }
  if (normalized === COMMUNITY_INVITE_RESPONSE_DECLINED_PREVIEW) {
    return readInviteResponsePreview(
      "declined",
      resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "response", "declined"),
      context,
    );
  }
  if (normalized === COMMUNITY_INVITE_RESPONSE_CANCELED_PREVIEW) {
    return readInviteResponsePreview(
      "canceled",
      resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "response", "canceled"),
      context,
    );
  }
  if (normalized === COMMUNITY_INVITE_RESPONSE_GENERIC_PREVIEW) {
    return readInviteResponsePreview(
      "",
      resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "response"),
      context,
    );
  }
  return null;
};

/**
 * Human-readable sidebar / chat-list preview for DM message content.
 * Structured invite payloads stay intact in storage; format at display time.
 */
export const formatConversationMessagePreview = (
  value: string,
  context?: ConversationPreviewContext,
): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const legacyPreview = remapLegacyInvitePreview(normalized, context);
  if (legacyPreview) {
    return legacyPreview;
  }

  if (normalized.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>;
      const type = typeof parsed.type === "string" ? parsed.type.trim() : "";
      if (type === "community-invite") {
        const payload = normalizeCommunityInvitePayload(parsed);
        const fromSelf = resolveCommunityInvitePreviewFromSelfForContent(normalized, context, "invite");
        return readInvitePreview(payload?.metadata?.name, fromSelf, context);
      }
      if (type === "community-invite-response") {
        const responseStatus = typeof parsed.status === "string"
          ? parsed.status.trim().toLowerCase()
          : "";
        const normalizedStatus = responseStatus === "declined"
          || responseStatus === "accepted"
          || responseStatus === "canceled"
          ? responseStatus
          : undefined;
        const fromSelf = resolveCommunityInvitePreviewFromSelfForContent(
          normalized,
          context,
          "response",
          normalizedStatus,
        );
        return readInviteResponsePreview(parsed.status, fromSelf, context);
      }
    } catch {
      // Fall through to plain-text preview.
    }
  }

  const plain = stripVoiceCallControlPreview(normalized).trim();
  return truncatePreview(plain);
};
