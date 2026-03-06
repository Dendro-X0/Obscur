type NotificationChannels = Readonly<{
  dmMessages: boolean;
  mentionsReplies: boolean;
  invitesSystem: boolean;
}>;

const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannels = {
  dmMessages: true,
  mentionsReplies: true,
  invitesSystem: true,
};

const DISABLED_NOTIFICATION_CHANNELS: NotificationChannels = {
  dmMessages: false,
  mentionsReplies: false,
  invitesSystem: false,
};

const normalizeNotificationChannels = (
  channels: Partial<NotificationChannels> | null | undefined,
  fallback: NotificationChannels
): NotificationChannels => {
  if (!channels) {
    return fallback;
  }
  return {
    dmMessages: typeof channels.dmMessages === "boolean" ? channels.dmMessages : fallback.dmMessages,
    mentionsReplies: typeof channels.mentionsReplies === "boolean" ? channels.mentionsReplies : fallback.mentionsReplies,
    invitesSystem: typeof channels.invitesSystem === "boolean" ? channels.invitesSystem : fallback.invitesSystem,
  };
};

const areNotificationsEnabled = (channels: NotificationChannels): boolean =>
  channels.dmMessages || channels.mentionsReplies || channels.invitesSystem;

export {
  DEFAULT_NOTIFICATION_CHANNELS,
  DISABLED_NOTIFICATION_CHANNELS,
  areNotificationsEnabled,
  normalizeNotificationChannels,
};

export type { NotificationChannels };
