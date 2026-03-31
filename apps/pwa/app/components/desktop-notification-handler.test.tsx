import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { DesktopNotificationHandler } from "./desktop-notification-handler";

const routingMocks = vi.hoisted(() => ({
  pathname: "/",
}));

const messagingMocks = vi.hoisted(() => ({
  selectedConversationId: null as string | null,
}));

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
    enabled: true,
    channels: {
      dmMessages: true,
      mentionsReplies: false,
      invitesSystem: false,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routingMocks.pathname,
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    selectedConversation: messagingMocks.selectedConversationId
      ? { id: messagingMocks.selectedConversationId }
      : null,
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
  timestamp: new Date(Date.now()),
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
    routingMocks.pathname = "/";
    messagingMocks.selectedConversationId = null;
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

  it("shows notifications when user is not viewing the same conversation", () => {
    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-1"));

    expect(notificationMocks.showNotification).toHaveBeenCalledWith(
      "New message from Alice",
      "hello from peer",
      "dmMessages"
    );
  });

  it("suppresses notifications while user is actively viewing the same chat", () => {
    messagingMocks.selectedConversationId = "conv-1";
    routingMocks.pathname = "/";
    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-2"));
    expect(notificationMocks.showNotification).not.toHaveBeenCalled();
  });

  it("shows notifications when app is backgrounded even for the same chat", () => {
    messagingMocks.selectedConversationId = "conv-1";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-bg"));
    expect(notificationMocks.showNotification).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates repeated events by event id", () => {
    render(<DesktopNotificationHandler />);
    const duplicate = createIncomingMessage("evt-3");
    messageBus.emitNewMessage("conv-1", duplicate);
    messageBus.emitNewMessage("conv-1", duplicate);

    expect(notificationMocks.showNotification).toHaveBeenCalledTimes(1);
  });
});
