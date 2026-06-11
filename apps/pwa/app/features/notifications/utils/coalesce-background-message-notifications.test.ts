import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_MESSAGE_NOTIFICATION_COALESCE_MS,
  buildCoalescedMessageNotificationTitle,
  createBackgroundMessageNotificationCoalescer,
} from "./coalesce-background-message-notifications";

describe("coalesce-background-message-notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds singular and plural notification titles", () => {
    expect(buildCoalescedMessageNotificationTitle("Tester1", 1)).toBe("New message from Tester1");
    expect(buildCoalescedMessageNotificationTitle("Tester1", 3)).toBe("3 new messages from Tester1");
  });

  it("coalesces rapid messages in the same conversation into one flush", () => {
    const onFlush = vi.fn();
    const coalescer = createBackgroundMessageNotificationCoalescer(onFlush);
    const presentation = {
      title: "New message from Tester1",
      body: "Direct message • 10:11 PM\ntest",
      href: "/?convId=conv-1",
    };

    coalescer.schedule({
      conversationId: "conv-1",
      senderName: "Tester1",
      presentation,
      forceBackgroundNotification: true,
    });
    coalescer.schedule({
      conversationId: "conv-1",
      senderName: "Tester1",
      presentation: {
        ...presentation,
        body: "Direct message • 10:12 PM\nsecond",
      },
      forceBackgroundNotification: true,
    });
    coalescer.schedule({
      conversationId: "conv-1",
      senderName: "Tester1",
      presentation: {
        ...presentation,
        body: "Direct message • 10:12 PM\nthird",
      },
      forceBackgroundNotification: true,
    });

    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(BACKGROUND_MESSAGE_NOTIFICATION_COALESCE_MS);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: "conv-1",
      senderName: "Tester1",
      messageCount: 3,
      presentation: expect.objectContaining({
        body: "Direct message • 10:12 PM\nthird",
      }),
    }));
    coalescer.dispose();
  });

  it("keeps separate coalesce windows per conversation", () => {
    const onFlush = vi.fn();
    const coalescer = createBackgroundMessageNotificationCoalescer(onFlush);

    coalescer.schedule({
      conversationId: "conv-a",
      senderName: "Alice",
      presentation: {
        title: "New message from Alice",
        body: "a",
        href: "/?convId=conv-a",
      },
      forceBackgroundNotification: true,
    });
    coalescer.schedule({
      conversationId: "conv-b",
      senderName: "Bob",
      presentation: {
        title: "New message from Bob",
        body: "b",
        href: "/?convId=conv-b",
      },
      forceBackgroundNotification: true,
    });

    vi.advanceTimersByTime(BACKGROUND_MESSAGE_NOTIFICATION_COALESCE_MS);
    expect(onFlush).toHaveBeenCalledTimes(2);
    coalescer.dispose();
  });
});
