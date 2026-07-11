import { normalizeCommunityInvitePayload } from "@/app/features/groups/utils/community-invite-payload";
import {
  resolveCommunityInvitePreviewFromSelfForContent,
  type CommunityInviteConversationPreviewContext,
} from "@/app/features/groups/services/community-invite-display-boundary";
import type { Attachment } from "../types";
import { extractAttachmentsFromContent, inferAttachmentKind } from "../utils/logic";
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

const MARKDOWN_ATTACHMENT_LINK_REGEX = /\[[^\]]*\]\([^)]+\)/g;

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

const stripMarkdownAttachmentLinks = (value: string): string => (
  value.replace(MARKDOWN_ATTACHMENT_LINK_REGEX, "").replace(/\s+/g, " ").trim()
);

const isPdfAttachment = (attachment: Attachment): boolean => {
  const kind = inferAttachmentKind(attachment);
  if (kind !== "file") {
    return false;
  }
  const lowerFileName = attachment.fileName.toLowerCase();
  const lowerContentType = attachment.contentType.toLowerCase();
  const lowerUrl = attachment.url.toLowerCase();
  return lowerFileName.endsWith(".pdf")
    || lowerContentType.includes("pdf")
    || lowerUrl.includes(".pdf");
};

const formatFileExtensionLabel = (fileName: string): string => {
  const trimmed = fileName.trim();
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return "File";
  }
  return `.${trimmed.slice(dotIndex + 1).toLowerCase()}`;
};

const formatSingleAttachmentPreview = (attachment: Attachment): string => {
  const kind = inferAttachmentKind(attachment);
  const fileName = attachment.fileName.trim() || "file";

  if (kind === "image") {
    return `Image (${fileName})`;
  }
  if (kind === "video") {
    return `Video (${fileName})`;
  }
  if (kind === "audio") {
    return `Audio (${fileName})`;
  }
  if (kind === "voice_note") {
    return `Voice note (${fileName})`;
  }
  if (isPdfAttachment(attachment)) {
    return `PDF (${fileName})`;
  }

  return `${formatFileExtensionLabel(fileName)} ${fileName}`;
};

const formatAttachmentMessagePreview = (value: string): string | null => {
  const attachments = extractAttachmentsFromContent(value, { includeGenericLinksAsFiles: true });
  if (attachments.length === 0) {
    return null;
  }

  const attachmentPreview = attachments.map(formatSingleAttachmentPreview).join(", ");
  const leadingText = stripMarkdownAttachmentLinks(value);
  if (!leadingText) {
    return attachmentPreview;
  }
  return `${leadingText} ${attachmentPreview}`;
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
  const attachmentPreview = formatAttachmentMessagePreview(plain);
  if (attachmentPreview) {
    return truncatePreview(attachmentPreview);
  }
  return truncatePreview(plain);
};
