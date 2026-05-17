import { getTauriAPI } from "@/app/features/desktop/utils/tauri-api";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";

export type RuntimeNotificationPermission = NotificationPermission | "unsupported";

export type RuntimeNotificationAction = Readonly<{
  action: string;
  title: string;
}>;

export type RuntimeNotificationParams = Readonly<{
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  actions?: ReadonlyArray<RuntimeNotificationAction>;
}>;

export type RuntimeNotificationResult = Readonly<{
  ok: boolean;
  permission: RuntimeNotificationPermission;
}>;

export const isTauri = (): boolean => getRuntimeCapabilities().supportsNativeNotifications;

const getBrowserPermission = (): RuntimeNotificationPermission => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  return Notification.permission;
};

export const getNotificationPermission = async (): Promise<RuntimeNotificationPermission> => {
  if (isTauri()) {
    const granted = await getTauriAPI().notification.isPermissionGranted();
    return granted ? "granted" : "default";
  }
  return getBrowserPermission();
};

export const requestRuntimeNotificationPermission = async (): Promise<RuntimeNotificationPermission> => {
  if (isTauri()) {
    return getTauriAPI().notification.requestPermission();
  }
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

export const showRuntimeNotification = async (
  params: RuntimeNotificationParams
): Promise<RuntimeNotificationResult> => {
  let permission = await getNotificationPermission();
  if (permission === "default") {
    permission = await requestRuntimeNotificationPermission();
  }
  if (permission !== "granted") {
    return { ok: false, permission };
  }

  if (isTauri()) {
    await getTauriAPI().notification.show({
      title: params.title,
      body: params.body,
      tag: params.tag,
      data: params.data,
      requireInteraction: params.requireInteraction,
      actions: params.actions,
    });
    return { ok: true, permission };
  }

  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { ok: false, permission: "unsupported" };
  }

  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker) {
      try {
        if (typeof navigator.serviceWorker.getRegistration === "function") {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && typeof registration.showNotification === "function") {
            const serviceWorkerOptions: NotificationOptions = {
              body: params.body,
              tag: params.tag,
              data: params.data,
              requireInteraction: params.requireInteraction,
            };
            if (params.actions && params.actions.length > 0) {
              (serviceWorkerOptions as NotificationOptions & { actions?: ReadonlyArray<RuntimeNotificationAction> }).actions = params.actions;
            }
            await registration.showNotification(params.title, serviceWorkerOptions);
            return { ok: true, permission };
          }
        }
      } catch {
        // Fallback to Notification constructor below.
      }
    }

    const browserOptions: NotificationOptions = {
      body: params.body,
      tag: params.tag,
      data: params.data,
      requireInteraction: params.requireInteraction,
    };
    if (params.actions && params.actions.length > 0) {
      (browserOptions as NotificationOptions & { actions?: ReadonlyArray<RuntimeNotificationAction> }).actions = params.actions;
    }
    const notification = new Notification(params.title, browserOptions);
    notification.onclick = (): void => {
      try {
        window.focus();
      } catch {
        // noop
      }
      params.onClick?.();
    };
    return { ok: true, permission };
  } catch {
    return { ok: false, permission };
  }
};

export async function notifyNewMessage(from: string, preview: string): Promise<RuntimeNotificationResult> {
  return showRuntimeNotification({
    title: from,
    body: preview,
    tag: "obscur-message",
  });
}
