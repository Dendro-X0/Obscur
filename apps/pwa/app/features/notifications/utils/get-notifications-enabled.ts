import { NOTIFICATION_STORAGE_KEY } from "./notification-storage-key";

type NotificationsEnabledResult = Readonly<{ enabled: boolean }>;

const getNotificationsEnabled = (): NotificationsEnabledResult => {
  if (typeof window === "undefined") {
    return { enabled: false };
  }
  try {
    const raw: string | null = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return { enabled: raw === "1" };
  } catch {
    return { enabled: false };
  }
};

export { getNotificationsEnabled };
