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

export const buildMessageNotificationPresentation = (params: Readonly<{
  senderName: string;
  preview: string;
  conversationId: string;
  timestampLabel?: string;
  contextLabel?: string;
  groupName?: string;
  iconUrl?: string;
}>): Readonly<{
  title: string;
  body: string;
  href: string;
  icon?: string;
}> => {
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
  const title = params.groupName
    ? `${params.senderName} in ${params.groupName}`
    : `New message from ${params.senderName}`;
  return {
    title,
    body: `${contextLabel} • ${timestampLabel}\n${preview}`,
    href: buildConversationNotificationHref(params.conversationId),
    icon: params.iconUrl,
  };
};

export const buildIncomingCallNotificationPresentation = (params: Readonly<{
  displayName: string;
  href?: string;
}>): Readonly<{
  title: string;
  body: string;
  href: string;
}> => {
  const displayName = clampInlineText(params.displayName || "Unknown caller");
  return {
    title: `Incoming voice call from ${displayName}`,
    body: "Open chat in Obscur to respond.",
    href: params.href || "/",
  };
};
