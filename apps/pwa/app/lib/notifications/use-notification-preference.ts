import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getNotificationsEnabled } from "./get-notifications-enabled";
import { setNotificationsEnabled } from "./set-notifications-enabled";

type NotificationPreferenceState = Readonly<{
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
}>;

type UseNotificationPreferenceResult = Readonly<{
  state: NotificationPreferenceState;
  setEnabled: (params: Readonly<{ enabled: boolean }>) => void;
}>;

type Listener = () => void;

const listeners: Set<Listener> = new Set<Listener>();

const notify = (): void => {
  listeners.forEach((listener: Listener): void => listener());
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
};

let cachedSnapshot: NotificationPreferenceState = { enabled: false, permission: "unsupported" };

const getSnapshot = (): NotificationPreferenceState => {
  const enabled: boolean = getNotificationsEnabled().enabled;
  const permission: NotificationPermission | "unsupported" =
    typeof window === "undefined" || typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  if (cachedSnapshot.enabled === enabled && cachedSnapshot.permission === permission) {
    return cachedSnapshot;
  }
  cachedSnapshot = { enabled, permission };
  return cachedSnapshot;
};

const useNotificationPreference = (): UseNotificationPreferenceResult => {
  const state: NotificationPreferenceState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect((): (() => void) => {
    if (typeof window === "undefined") {
      return (): void => {
        return;
      };
    }
    const onStorage = (event: StorageEvent): void => {
      if (!event.key || !event.key.endsWith("notifications.enabled")) {
        return;
      }
      notify();
    };
    window.addEventListener("storage", onStorage);
    return (): void => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const setEnabledStable = useMemo((): ((params: Readonly<{ enabled: boolean }>) => void) => {
    return (params: Readonly<{ enabled: boolean }>): void => {
      setNotificationsEnabled({ enabled: params.enabled });
      notify();
    };
  }, []);
  return { state, setEnabled: setEnabledStable };
};

export { useNotificationPreference };
