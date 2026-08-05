import {
  notificationContentKindEmoji,
  notificationContentKindIconDataUri,
  resolveNotificationContentKindFromPreview,
  type NotificationContentKind,
} from "./notification-content-kind";

const MAX_MESSAGE_NOTIFICATION_PREVIEW_LENGTH = 120;

const clampInlineText = (value: string): string => value.replace(/\s+/g, " ").trim();

const trimWithEllipsis = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const buildConversationNotificationHref = (conversationId: string): string => (
  `/?convId=${encodeURIComponent(conversationId)}`
);

export type MessageNotificationPresentation = Readonly<{
  title: string;
  body: string;
  href: string;
  icon?: string;
  contentKind: NotificationContentKind;
}>;

export const buildMessageNotificationPresentation = (params: Readonly<{
  senderName: string;
  preview: string;
  conversationId: string;
  timestampLabel?: string;
  contextLabel?: string;
  groupName?: string;
  iconUrl?: string;
}>): MessageNotificationPresentation => {
  const contextLabel = clampInlineText(
    params.groupName
      ? params.groupName
      : (params.contextLabel || "Direct message"),
  );
  const timestampLabel = clampInlineText(params.timestampLabel || "Just now");
  const preview = trimWithEllipsis(
    clampInlineText(params.preview || "Sent a message"),
    MAX_MESSAGE_NOTIFICATION_PREVIEW_LENGTH,
  );
  const contentKind = resolveNotificationContentKindFromPreview(preview);
  const kindEmoji = notificationContentKindEmoji(contentKind);
  // Title = main line without emoji; single kind glyph lives on the description line.
  const title = params.groupName
    ? `${params.senderName} in ${params.groupName}`
    : `New message from ${params.senderName}`;
  return {
    title,
    body: `${kindEmoji} ${contextLabel} • ${timestampLabel}\n${preview}`,
    href: buildConversationNotificationHref(params.conversationId),
    icon: params.iconUrl || notificationContentKindIconDataUri(contentKind),
    contentKind,
  };
};

export const buildIncomingCallNotificationPresentation = (params: Readonly<{
  displayName: string;
  href?: string;
  iconUrl?: string;
}>): MessageNotificationPresentation => {
  const displayName = clampInlineText(params.displayName || "Unknown caller");
  const contentKind: NotificationContentKind = "call";
  // Title = caller name (circular avatar sits to the left on Windows).
  // Body = single preview line — no duplicate call emoji (avatar / one glyph is the icon).
  return {
    title: displayName,
    body: "Incoming voice call",
    href: params.href || "/",
    icon: params.iconUrl || notificationContentKindIconDataUri(contentKind),
    contentKind,
  };
};
