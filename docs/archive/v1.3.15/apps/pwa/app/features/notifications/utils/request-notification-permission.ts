import { requestRuntimeNotificationPermission } from "@/app/lib/notification-service";

type RequestNotificationPermissionResult = Readonly<{ permission: NotificationPermission | "unsupported" }>;

const requestNotificationPermission = async (): Promise<RequestNotificationPermissionResult> => ({
  permission: await requestRuntimeNotificationPermission(),
});

export { requestNotificationPermission };
