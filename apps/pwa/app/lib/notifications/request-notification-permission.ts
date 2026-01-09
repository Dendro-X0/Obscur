type RequestNotificationPermissionResult = Readonly<{ permission: NotificationPermission | "unsupported" }>;

const requestNotificationPermission = async (): Promise<RequestNotificationPermissionResult> => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { permission: "unsupported" };
  }
  try {
    const permission: NotificationPermission = await Notification.requestPermission();
    return { permission };
  } catch {
    return { permission: Notification.permission };
  }
};

export { requestNotificationPermission };
