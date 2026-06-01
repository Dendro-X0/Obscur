import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import { stripVoiceCallControlPreview } from "./realtime-voice-signaling";

export const COMMUNITY_INVITE_LIST_PREVIEW = "Community invitation";
export const COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW = "Accepted community invite";
export const COMMUNITY_INVITE_RESPONSE_DECLINED_PREVIEW = "Declined community invite";
export const COMMUNITY_INVITE_RESPONSE_CANCELED_PREVIEW = "Community invite withdrawn";
export const COMMUNITY_INVITE_RESPONSE_GENERIC_PREVIEW = "Community invite update";

const PREVIEW_MAX_LENGTH = 140;

const truncatePreview = (value: string): string => {
  if (value.length <= PREVIEW_MAX_LENGTH) {
    return value;
  }
  return `${value.slice(0, PREVIEW_MAX_LENGTH)}...`;
};

const readInviteResponsePreview = (status: unknown): string => {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "accepted") {
    return COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW;
  }
  if (normalized === "declined" || normalized === "rejected") {
    return COMMUNITY_INVITE_RESPONSE_DECLINED_PREVIEW;
  }
  if (normalized === "canceled" || normalized === "cancelled") {
    return COMMUNITY_INVITE_RESPONSE_CANCELED_PREVIEW;
  }
  return COMMUNITY_INVITE_RESPONSE_GENERIC_PREVIEW;
};

/**
 * Human-readable sidebar / chat-list preview for DM message content.
 * Structured invite payloads stay intact in storage; format at display time.
 */
export const formatConversationMessagePreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("{")) {
    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>;
      const type = typeof parsed.type === "string" ? parsed.type.trim() : "";
      if (type === "community-invite") {
        const invite = normalizeCommunityInvitePayload(parsed);
        const name = invite?.metadata.name?.trim();
        return name ? `Community invite: ${name}` : COMMUNITY_INVITE_LIST_PREVIEW;
      }
      if (type === "community-invite-response") {
        return readInviteResponsePreview(parsed.status);
      }
    } catch {
      // Fall through to plain-text preview.
    }
  }

  const plain = stripVoiceCallControlPreview(normalized).trim();
  return truncatePreview(plain);
};
