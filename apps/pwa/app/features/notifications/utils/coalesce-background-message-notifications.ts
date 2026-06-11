export const BACKGROUND_MESSAGE_NOTIFICATION_COALESCE_MS = 1_200;

export type BackgroundMessageNotificationPresentation = Readonly<{
  title: string;
  body: string;
  href: string;
  icon?: string;
}>;

export type BackgroundMessageNotificationPayload = Readonly<{
  conversationId: string;
  senderName: string;
  presentation: BackgroundMessageNotificationPresentation;
  forceBackgroundNotification: boolean;
}>;

export type CoalescedBackgroundMessageNotification = Readonly<{
  conversationId: string;
  senderName: string;
  messageCount: number;
  presentation: BackgroundMessageNotificationPresentation;
  forceBackgroundNotification: boolean;
}>;

export const buildCoalescedMessageNotificationTitle = (
  senderName: string,
  messageCount: number,
): string => (
  messageCount === 1
    ? `New message from ${senderName}`
    : `${messageCount} new messages from ${senderName}`
);

type PendingCoalescedNotification = {
  senderName: string;
  count: number;
  presentation: BackgroundMessageNotificationPresentation;
  forceBackgroundNotification: boolean;
  timerId: ReturnType<typeof setTimeout>;
};

export const createBackgroundMessageNotificationCoalescer = (
  onFlush: (payload: CoalescedBackgroundMessageNotification) => void,
  coalesceMs: number = BACKGROUND_MESSAGE_NOTIFICATION_COALESCE_MS,
): Readonly<{
  schedule: (payload: BackgroundMessageNotificationPayload) => void;
  dispose: () => void;
  flushNow: (conversationId?: string) => void;
}> => {
  const pending = new Map<string, PendingCoalescedNotification>();

  const flushConversation = (conversationId: string): void => {
    const entry = pending.get(conversationId);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timerId);
    pending.delete(conversationId);
    onFlush({
      conversationId,
      senderName: entry.senderName,
      messageCount: entry.count,
      presentation: entry.presentation,
      forceBackgroundNotification: entry.forceBackgroundNotification,
    });
  };

  return {
    schedule(payload: BackgroundMessageNotificationPayload): void {
      const existing = pending.get(payload.conversationId);
      if (existing) {
        clearTimeout(existing.timerId);
        existing.count += 1;
        existing.presentation = payload.presentation;
        existing.forceBackgroundNotification = payload.forceBackgroundNotification;
        existing.timerId = setTimeout(() => {
          flushConversation(payload.conversationId);
        }, coalesceMs);
        return;
      }

      const timerId = setTimeout(() => {
        flushConversation(payload.conversationId);
      }, coalesceMs);
      pending.set(payload.conversationId, {
        senderName: payload.senderName,
        count: 1,
        presentation: payload.presentation,
        forceBackgroundNotification: payload.forceBackgroundNotification,
        timerId,
      });
    },
    dispose(): void {
      for (const [conversationId, entry] of pending.entries()) {
        clearTimeout(entry.timerId);
        pending.delete(conversationId);
      }
    },
    flushNow(conversationId?: string): void {
      if (conversationId) {
        flushConversation(conversationId);
        return;
      }
      for (const id of [...pending.keys()]) {
        flushConversation(id);
      }
    },
  };
};
