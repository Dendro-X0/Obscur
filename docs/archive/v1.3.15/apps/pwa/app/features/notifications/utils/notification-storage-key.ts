import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

const NOTIFICATION_STORAGE_KEY: string = "dweb.nostr.pwa.notifications.enabled";
const NOTIFICATION_CHANNELS_STORAGE_KEY: string = "dweb.nostr.pwa.notifications.channels.v1";

const getNotificationStorageKey = (): string => getScopedStorageKey(NOTIFICATION_STORAGE_KEY);
const getNotificationChannelsStorageKey = (): string => getScopedStorageKey(NOTIFICATION_CHANNELS_STORAGE_KEY);

export {
  NOTIFICATION_STORAGE_KEY,
  NOTIFICATION_CHANNELS_STORAGE_KEY,
  getNotificationStorageKey,
  getNotificationChannelsStorageKey
};
