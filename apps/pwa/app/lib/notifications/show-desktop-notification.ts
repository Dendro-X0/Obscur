type ShowDesktopNotificationParams = Readonly<{ title: string; body: string; tag: string }>;

type ShowDesktopNotificationResult = Readonly<{ ok: boolean }>;

const showDesktopNotification = (params: ShowDesktopNotificationParams): ShowDesktopNotificationResult => {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return { ok: false };
  }
  if (Notification.permission !== "granted") {
    return { ok: false };
  }
  try {
    const notification: Notification = new Notification(params.title, {
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
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

export { showDesktopNotification };
