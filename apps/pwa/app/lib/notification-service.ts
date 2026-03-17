import { getTauriAPI } from "@/app/features/desktop/utils/tauri-api";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";

export type RuntimeNotificationPermission = NotificationPermission | "unsupported";

export type RuntimeNotificationParams = Readonly<{
  title: string;
  body: string;
  tag?: string;
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
  const permission = await getNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, permission };
  }

  if (isTauri()) {
    await getTauriAPI().notification.show({ title: params.title, body: params.body });
    return { ok: true, permission };
  }

  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { ok: false, permission: "unsupported" };
  }

  try {
    const notification = new Notification(params.title, {
      body: params.body,
      tag: params.tag,
    });
    notification.onclick = (): void => {
      try {
        window.focus();
      } catch {
        return;
      }
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
