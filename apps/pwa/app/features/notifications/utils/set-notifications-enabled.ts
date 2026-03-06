import { NOTIFICATION_CHANNELS_STORAGE_KEY, NOTIFICATION_STORAGE_KEY } from "./notification-storage-key";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  DISABLED_NOTIFICATION_CHANNELS,
  normalizeNotificationChannels,
  type NotificationChannels,
} from "./notification-channels";

type SetNotificationsEnabledParams = Readonly<{ enabled: boolean }>;
type SetNotificationChannelsParams = Readonly<{ channels: Partial<NotificationChannels> }>;

type SetNotificationsEnabledResult = Readonly<{ ok: boolean }>;

const setNotificationsEnabled = (params: SetNotificationsEnabledParams): SetNotificationsEnabledResult => {
  if (typeof window === "undefined") {
    return { ok: false };
  }
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, params.enabled ? "1" : "0");
    const channels = params.enabled ? DEFAULT_NOTIFICATION_CHANNELS : DISABLED_NOTIFICATION_CHANNELS;
    window.localStorage.setItem(NOTIFICATION_CHANNELS_STORAGE_KEY, JSON.stringify(channels));
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

const setNotificationChannels = (params: SetNotificationChannelsParams): SetNotificationsEnabledResult => {
  if (typeof window === "undefined") {
    return { ok: false };
  }
  try {
    const existingRaw = window.localStorage.getItem(NOTIFICATION_CHANNELS_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as Partial<NotificationChannels>) : null;
    const fallback = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) === "0" ? DISABLED_NOTIFICATION_CHANNELS : DEFAULT_NOTIFICATION_CHANNELS;
    const channels = normalizeNotificationChannels({ ...existing, ...params.channels }, fallback);
    const enabled = channels.dmMessages || channels.mentionsReplies || channels.invitesSystem;
    window.localStorage.setItem(NOTIFICATION_CHANNELS_STORAGE_KEY, JSON.stringify(channels));
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, enabled ? "1" : "0");
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

export { setNotificationsEnabled, setNotificationChannels };
