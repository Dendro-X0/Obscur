import { NOTIFICATION_STORAGE_KEY } from "./notification-storage-key";

type SetNotificationsEnabledParams = Readonly<{ enabled: boolean }>;

type SetNotificationsEnabledResult = Readonly<{ ok: boolean }>;

const setNotificationsEnabled = (params: SetNotificationsEnabledParams): SetNotificationsEnabledResult => {
  if (typeof window === "undefined") {
    return { ok: false };
  }
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, params.enabled ? "1" : "0");
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

export { setNotificationsEnabled };
