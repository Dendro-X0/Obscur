import { getNotificationChannelsStorageKey, getNotificationStorageKey } from "./notification-storage-key";
import {
  areNotificationsEnabled,
  DEFAULT_NOTIFICATION_CHANNELS,
  DISABLED_NOTIFICATION_CHANNELS,
  normalizeNotificationChannels,
  type NotificationChannels,
} from "./notification-channels";

type NotificationsEnabledResult = Readonly<{ enabled: boolean; channels: NotificationChannels }>;

const getNotificationsEnabled = (): NotificationsEnabledResult => {
  if (typeof window === "undefined") {
    return { enabled: false, channels: DISABLED_NOTIFICATION_CHANNELS };
  }
  try {
    const raw: string | null =
      window.localStorage.getItem(getNotificationStorageKey())
      ?? window.localStorage.getItem("dweb.nostr.pwa.notifications.enabled");
    const rawChannels =
      window.localStorage.getItem(getNotificationChannelsStorageKey())
      ?? window.localStorage.getItem("dweb.nostr.pwa.notifications.channels.v1");
    if (rawChannels) {
      try {
        const parsed = JSON.parse(rawChannels) as Partial<NotificationChannels>;
        const fallback = raw === "0" ? DISABLED_NOTIFICATION_CHANNELS : DEFAULT_NOTIFICATION_CHANNELS;
        const channels = normalizeNotificationChannels(parsed, fallback);
        return { enabled: areNotificationsEnabled(channels), channels };
      } catch {
        // Fall through to legacy boolean behavior.
      }
    }
    const legacyEnabled = raw === "1";
    const channels = legacyEnabled ? DEFAULT_NOTIFICATION_CHANNELS : DISABLED_NOTIFICATION_CHANNELS;
    return { enabled: legacyEnabled, channels };
  } catch {
    return { enabled: false, channels: DISABLED_NOTIFICATION_CHANNELS };
  }
};

export { getNotificationsEnabled };
