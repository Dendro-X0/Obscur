import { showRuntimeNotification } from "@/app/lib/notification-service";

type ShowDesktopNotificationParams = Readonly<{
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  actions?: ReadonlyArray<Readonly<{ action: string; title: string }>>;
}>;

type ShowDesktopNotificationResult = Readonly<{ ok: boolean }>;

const showDesktopNotification = async (
  params: ShowDesktopNotificationParams
): Promise<ShowDesktopNotificationResult> => {
  const result = await showRuntimeNotification(params);
  return { ok: result.ok };
};

export { showDesktopNotification };
