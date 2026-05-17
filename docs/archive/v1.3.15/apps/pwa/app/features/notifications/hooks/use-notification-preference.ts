import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getNotificationsEnabled } from "../utils/get-notifications-enabled";
import { setNotificationChannels, setNotificationsEnabled } from "../utils/set-notifications-enabled";
import type { NotificationChannels } from "../utils/notification-channels";
import { getNotificationPermission } from "@/app/lib/notification-service";

type NotificationPreferenceState = Readonly<{
  enabled: boolean;
  channels: NotificationChannels;
  permission: NotificationPermission | "unsupported";
}>;

type UseNotificationPreferenceResult = Readonly<{
  state: NotificationPreferenceState;
  setEnabled: (params: Readonly<{ enabled: boolean }>) => void;
  setChannels: (params: Readonly<{ channels: Partial<NotificationChannels> }>) => void;
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

let cachedSnapshot: NotificationPreferenceState = {
  enabled: false,
  channels: { dmMessages: false, mentionsReplies: false, invitesSystem: false },
  permission: "unsupported"
};

const refreshPermission = async (): Promise<void> => {
  const permission = await getNotificationPermission();
  if (cachedSnapshot.permission === permission) {
    return;
  }
  cachedSnapshot = {
    ...cachedSnapshot,
    permission,
  };
  notify();
};

const getSnapshot = (): NotificationPreferenceState => {
  const preference = getNotificationsEnabled();
  if (
    cachedSnapshot.enabled === preference.enabled
    && cachedSnapshot.channels.dmMessages === preference.channels.dmMessages
    && cachedSnapshot.channels.mentionsReplies === preference.channels.mentionsReplies
    && cachedSnapshot.channels.invitesSystem === preference.channels.invitesSystem
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = {
    enabled: preference.enabled,
    channels: preference.channels,
    permission: cachedSnapshot.permission,
  };
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
    void refreshPermission();
    const onStorage = (event: StorageEvent): void => {
      if (!event.key || !event.key.startsWith("dweb.nostr.pwa.notifications.")) {
        return;
      }
      notify();
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") {
        void refreshPermission();
      }
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return (): void => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const setEnabledStable = useMemo((): ((params: Readonly<{ enabled: boolean }>) => void) => {
    return (params: Readonly<{ enabled: boolean }>): void => {
      setNotificationsEnabled({ enabled: params.enabled });
      notify();
    };
  }, []);
  const setChannelsStable = useMemo((): ((params: Readonly<{ channels: Partial<NotificationChannels> }>) => void) => {
    return (params: Readonly<{ channels: Partial<NotificationChannels> }>): void => {
      setNotificationChannels({ channels: params.channels });
      notify();
    };
  }, []);
  return useMemo(
    () => ({ state, setEnabled: setEnabledStable, setChannels: setChannelsStable }),
    [state, setEnabledStable, setChannelsStable]
  );
};

export { useNotificationPreference };
