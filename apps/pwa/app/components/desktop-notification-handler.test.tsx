import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { DesktopNotificationHandler } from "./desktop-notification-handler";

const notificationMocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
}));

const discoveryCacheMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
  useTauri: vi.fn(),
}));

vi.mock("@/app/features/desktop/hooks/use-desktop-notifications", () => ({
  useDesktopNotifications: () => ({
    showNotification: notificationMocks.showNotification,
  }),
}));

vi.mock("@/app/features/search/services/discovery-cache", () => ({
  discoveryCache: {
    getProfile: discoveryCacheMocks.getProfile,
  },
}));

const createIncomingMessage = (id: string): Message => ({
  id,
  eventId: id,
  kind: "user",
  content: "hello from peer",
  timestamp: new Date(1_000),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: "b".repeat(64) as PublicKeyHex,
  conversationId: "conv-1",
});

describe("DesktopNotificationHandler", () => {
  beforeEach(() => {
    notificationMocks.showNotification.mockReset();
    discoveryCacheMocks.getProfile.mockReset();
    discoveryCacheMocks.getProfile.mockReturnValue({ displayName: "Alice" });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows notifications for incoming messages only when app is backgrounded", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-1"));

    expect(notificationMocks.showNotification).toHaveBeenCalledWith(
      "New message from Alice",
      "hello from peer",
      "dmMessages"
    );
  });

  it("suppresses notifications while app is visible and focused", () => {
    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-2"));
    expect(notificationMocks.showNotification).not.toHaveBeenCalled();
  });

  it("de-duplicates repeated events by event id", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<DesktopNotificationHandler />);
    const duplicate = createIncomingMessage("evt-3");
    messageBus.emitNewMessage("conv-1", duplicate);
    messageBus.emitNewMessage("conv-1", duplicate);

    expect(notificationMocks.showNotification).toHaveBeenCalledTimes(1);
  });
});
