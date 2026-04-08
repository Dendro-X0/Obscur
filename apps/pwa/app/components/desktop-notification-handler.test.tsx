import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { DesktopNotificationHandler } from "./desktop-notification-handler";

const routingMocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
}));

const messagingMocks = vi.hoisted(() => ({
  selectedConversationId: null as string | null,
  chatsUnreadCount: 0 as number,
  setUnreadByConversationId: vi.fn(),
  createdConnections: [] as ReadonlyArray<Readonly<{ id: string; pubkey: string; displayName: string }>>,
}));

const notificationMocks = vi.hoisted(() => ({
  showNotification: vi.fn(),
  channels: {
    dmMessages: true,
    mentionsReplies: false,
    invitesSystem: true,
  },
}));

const discoveryCacheMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
}));

const voiceOverlayMocks = vi.hoisted(() => ({
  status: null as null | Readonly<{
    roomId: string;
    peerPubkey: string;
    phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
    role: "host" | "joiner";
    sinceUnixMs: number;
  }>,
  peerDisplayName: "Unknown caller",
  peerAvatarUrl: "",
}));

const notificationTargetPreferenceMocks = vi.hoisted(() => ({
  isMessageNotificationEnabledForIncomingEvent: vi.fn(() => true),
}));

const voiceOverlayActionBridgeMocks = vi.hoisted(() => ({
  dispatchVoiceCallOverlayAction: vi.fn(),
}));

const serviceWorkerMocks = vi.hoisted(() => ({
  container: new EventTarget(),
}));

const unreadTaskbarBadgeMocks = vi.hoisted(() => ({
  applyDesktopUnreadTaskbarBadge: vi.fn(),
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
  useTauri: vi.fn(),
}));

vi.mock("@/app/features/desktop/hooks/use-desktop-notifications", () => ({
  useDesktopNotifications: () => ({
    showNotification: notificationMocks.showNotification,
    enabled: true,
    channels: notificationMocks.channels,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routingMocks.pathname,
  useRouter: () => ({
    push: routingMocks.push,
  }),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    selectedConversation: messagingMocks.selectedConversationId
      ? { id: messagingMocks.selectedConversationId }
      : null,
    chatsUnreadCount: messagingMocks.chatsUnreadCount,
    setUnreadByConversationId: messagingMocks.setUnreadByConversationId,
    createdConnections: messagingMocks.createdConnections,
  }),
}));

vi.mock("@/app/features/search/services/discovery-cache", () => ({
  discoveryCache: {
    getProfile: discoveryCacheMocks.getProfile,
  },
}));

vi.mock("@/app/features/messaging/services/realtime-voice-global-ui-store", () => ({
  useGlobalVoiceCallOverlayState: () => ({
    status: voiceOverlayMocks.status,
    peerDisplayName: voiceOverlayMocks.peerDisplayName,
    peerAvatarUrl: voiceOverlayMocks.peerAvatarUrl,
  }),
}));

vi.mock("@/app/features/notifications/utils/notification-target-preference", () => ({
  isMessageNotificationEnabledForIncomingEvent: notificationTargetPreferenceMocks.isMessageNotificationEnabledForIncomingEvent,
}));

vi.mock("@/app/features/messaging/services/voice-call-overlay-action-bridge", () => ({
  dispatchVoiceCallOverlayAction: voiceOverlayActionBridgeMocks.dispatchVoiceCallOverlayAction,
  extractVoiceCallOverlayAction: (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const action = (payload as { action?: unknown }).action;
    if (
      action === "open_chat"
      || action === "accept"
      || action === "decline"
      || action === "end"
      || action === "dismiss"
    ) {
      return action;
    }
    return null;
  },
}));

vi.mock("@/app/features/desktop/utils/unread-taskbar-badge", () => ({
  applyDesktopUnreadTaskbarBadge: unreadTaskbarBadgeMocks.applyDesktopUnreadTaskbarBadge,
}));

vi.mock("@/app/lib/notification-service", () => ({
  isTauri: () => false,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

const createIncomingMessage = (
  id: string,
  overrides?: Partial<Message>
): Message => ({
  id,
  eventId: id,
  kind: "user",
  content: "hello from peer",
  timestamp: new Date(Date.now()),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: "b".repeat(64) as PublicKeyHex,
  conversationId: "conv-1",
  ...overrides,
});

describe("DesktopNotificationHandler", () => {
  beforeEach(() => {
    notificationMocks.showNotification.mockReset();
    notificationMocks.channels.dmMessages = true;
    notificationMocks.channels.invitesSystem = true;
    discoveryCacheMocks.getProfile.mockReset();
    discoveryCacheMocks.getProfile.mockReturnValue({ displayName: "Alice" });
    voiceOverlayMocks.status = null;
    voiceOverlayMocks.peerDisplayName = "Unknown caller";
    voiceOverlayMocks.peerAvatarUrl = "";
    voiceOverlayActionBridgeMocks.dispatchVoiceCallOverlayAction.mockReset();
    notificationTargetPreferenceMocks.isMessageNotificationEnabledForIncomingEvent.mockReset();
    notificationTargetPreferenceMocks.isMessageNotificationEnabledForIncomingEvent.mockReturnValue(true);
    routingMocks.pathname = "/";
    routingMocks.push.mockReset();
    messagingMocks.selectedConversationId = null;
    messagingMocks.chatsUnreadCount = 0;
    messagingMocks.setUnreadByConversationId.mockReset();
    messagingMocks.createdConnections = [];
    unreadTaskbarBadgeMocks.applyDesktopUnreadTaskbarBadge.mockReset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(document, "hasFocus", {
      configurable: true,
      value: vi.fn(() => true),
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerMocks.container,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an in-app message card when user is not viewing the same conversation in foreground", async () => {
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-1"));
    });

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("hello from peer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open chat/i })).toBeInTheDocument();
    expect(notificationMocks.showNotification).not.toHaveBeenCalled();
  });

  it("uses conversation display name fallback when profile cache is missing", async () => {
    discoveryCacheMocks.getProfile.mockReturnValue(null);
    messagingMocks.createdConnections = [{
      id: "conv-1",
      pubkey: "b".repeat(64),
      displayName: "Tester2",
    }];

    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-fallback-name"));
    });

    await waitFor(() => {
      expect(screen.getByText("Tester2")).toBeTruthy();
    });
  });

  it("updates desktop unread taskbar badge from unread + incoming-call state", () => {
    messagingMocks.chatsUnreadCount = 7;
    const { rerender } = render(<DesktopNotificationHandler />);
    expect(unreadTaskbarBadgeMocks.applyDesktopUnreadTaskbarBadge).toHaveBeenCalledWith(7);

    voiceOverlayMocks.status = {
      roomId: "dm-voice-call-room-badge",
      peerPubkey: "f".repeat(64),
      phase: "ringing_incoming",
      role: "joiner",
      sinceUnixMs: Date.now(),
    };
    rerender(<DesktopNotificationHandler />);

    expect(unreadTaskbarBadgeMocks.applyDesktopUnreadTaskbarBadge).toHaveBeenCalledWith(8);
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
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-bg"));
    });
    expect(notificationMocks.showNotification).toHaveBeenCalledTimes(1);
  });

  it("increments badge from background notifications even when unread projection is zero", async () => {
    messagingMocks.selectedConversationId = "conv-1";
    messagingMocks.chatsUnreadCount = 0;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-bg-badge"));
    });

    await waitFor(() => {
      expect(unreadTaskbarBadgeMocks.applyDesktopUnreadTaskbarBadge).toHaveBeenLastCalledWith(1);
    });
  });

  it("de-duplicates repeated events by event id for in-app message cards", async () => {
    render(<DesktopNotificationHandler />);
    const duplicate = createIncomingMessage("evt-3");
    act(() => {
      messageBus.emitNewMessage("conv-1", duplicate);
      messageBus.emitNewMessage("conv-1", duplicate);
    });

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button", { name: /open chat/i })).toHaveLength(1);
    expect(notificationMocks.showNotification).not.toHaveBeenCalled();
  });

  it("marks conversation unread as cleared when user taps mark-read on in-app card", async () => {
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-mark-read"));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /mark read/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));

    expect(messagingMocks.setUnreadByConversationId).toHaveBeenCalledTimes(1);
  });

  it("routes open-chat action to canonical convId deep-link token", async () => {
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("dm:self:peer-a", createIncomingMessage("evt-open-route"));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /open chat/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /open chat/i }));

    expect(routingMocks.push).toHaveBeenCalledWith("/?convId=dm%3Aself%3Apeer-a");
  });

  it("routes reply action to canonical convId deep-link token", async () => {
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("dm:self:peer-b", createIncomingMessage("evt-reply-route"));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reply/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /reply/i }));

    expect(routingMocks.push).toHaveBeenCalledWith("/?convId=dm%3Aself%3Apeer-b");
  });

  it("suppresses notifications when the target conversation preference is disabled", () => {
    notificationTargetPreferenceMocks.isMessageNotificationEnabledForIncomingEvent.mockReturnValue(false);
    render(<DesktopNotificationHandler />);
    messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-muted"));

    expect(notificationMocks.showNotification).not.toHaveBeenCalled();
  });

  it("renders voice-call-invite payloads as incoming-call notifications instead of JSON message previews", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-call-json", {
        content: JSON.stringify({
          type: "voice-call-invite",
          version: 1,
          roomId: "dm-voice-call-abcdef0123456789",
          fromPubkey: "b".repeat(64),
        }),
      }));
    });

    expect(notificationMocks.showNotification).toHaveBeenCalledWith(
      "Incoming voice call from Alice",
      "Open chat in Obscur to respond.",
      "invitesSystem",
      expect.objectContaining({
        data: expect.objectContaining({
          href: "/?convId=conv-1",
          overlayAction: "open_chat",
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ action: "open_chat", title: "Open chat" }),
        ]),
      }),
    );
    expect(notificationMocks.showNotification).not.toHaveBeenCalledWith(
      expect.stringContaining("New message from"),
      expect.stringContaining("voice-call-invite"),
      "dmMessages",
      expect.anything(),
    );
  });

  it("shows incoming-call desktop notifications while app is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { rerender } = render(<DesktopNotificationHandler />);
    voiceOverlayMocks.peerDisplayName = "Tester2";
    voiceOverlayMocks.status = {
      roomId: "dm-voice-call-room-1234567890abcdef",
      peerPubkey: "c".repeat(64),
      phase: "ringing_incoming",
      role: "joiner",
      sinceUnixMs: Date.now(),
    };
    rerender(<DesktopNotificationHandler />);

    expect(notificationMocks.showNotification).toHaveBeenCalledWith(
      "Incoming voice call from Tester2",
      "Open chat in Obscur to respond.",
      "invitesSystem",
      expect.objectContaining({
        onClick: expect.any(Function),
        data: expect.objectContaining({
          overlayAction: "open_chat",
          href: "/",
        }),
        requireInteraction: true,
        actions: expect.arrayContaining([
          expect.objectContaining({ action: "open_chat", title: "Open chat" }),
        ]),
      }),
    );
  });

  it("dispatches open-chat action when incoming-call notification is clicked", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { rerender } = render(<DesktopNotificationHandler />);
    voiceOverlayMocks.peerDisplayName = "Tester2";
    voiceOverlayMocks.status = {
      roomId: "dm-voice-call-room-click",
      peerPubkey: "e".repeat(64),
      phase: "ringing_incoming",
      role: "joiner",
      sinceUnixMs: Date.now(),
    };
    rerender(<DesktopNotificationHandler />);

    const clickHandler = notificationMocks.showNotification.mock.calls[0]?.[3]?.onClick as (() => void) | undefined;
    expect(typeof clickHandler).toBe("function");
    clickHandler?.();

    expect(voiceOverlayActionBridgeMocks.dispatchVoiceCallOverlayAction).toHaveBeenCalledWith("open_chat");
  });

  it("routes background message notification clicks to the exact conversation href", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    render(<DesktopNotificationHandler />);

    act(() => {
      messageBus.emitNewMessage("dm:self:peer-c", createIncomingMessage("evt-bg-route"));
    });

    expect(notificationMocks.showNotification).toHaveBeenCalledWith(
      "New message from Alice",
      expect.stringMatching(/^Direct message • .+\nhello from peer$/),
      "dmMessages",
      expect.objectContaining({
        onClick: expect.any(Function),
        data: expect.objectContaining({
          href: "/?convId=dm%3Aself%3Apeer-c",
        }),
      }),
    );

    const clickHandler = notificationMocks.showNotification.mock.calls[0]?.[3]?.onClick as (() => void) | undefined;
    clickHandler?.();

    expect(routingMocks.push).toHaveBeenCalledWith("/?convId=dm%3Aself%3Apeer-c");
  });

  it("routes to chat and dispatches accept when fallback incoming-call card is accepted off-chat route", async () => {
    routingMocks.pathname = "/settings";
    render(<DesktopNotificationHandler />);
    act(() => {
      messageBus.emitNewMessage("conv-1", createIncomingMessage("evt-call-accept-route", {
        content: JSON.stringify({
          type: "voice-call-invite",
          version: 1,
          roomId: "dm-voice-call-accept-anywhere-room",
          fromPubkey: "b".repeat(64),
        }),
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /accept/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: /accept/i }));

    expect(voiceOverlayActionBridgeMocks.dispatchVoiceCallOverlayAction).toHaveBeenCalledWith("accept");
    expect(routingMocks.push).toHaveBeenCalledWith("/");
  });

  it("de-duplicates repeated incoming-call notifications for the same room", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { rerender } = render(<DesktopNotificationHandler />);
    voiceOverlayMocks.peerDisplayName = "Tester2";
    voiceOverlayMocks.status = {
      roomId: "dm-voice-call-room-dup",
      peerPubkey: "d".repeat(64),
      phase: "ringing_incoming",
      role: "joiner",
      sinceUnixMs: Date.now(),
    };
    rerender(<DesktopNotificationHandler />);
    voiceOverlayMocks.status = {
      roomId: "dm-voice-call-room-dup",
      peerPubkey: "d".repeat(64),
      phase: "ringing_incoming",
      role: "joiner",
      sinceUnixMs: Date.now() + 1,
    };
    rerender(<DesktopNotificationHandler />);

    expect(notificationMocks.showNotification).toHaveBeenCalledTimes(1);
  });

  it("forwards service-worker notification clicks into voice-call overlay action dispatch", () => {
    render(<DesktopNotificationHandler />);
    const messageEvent = new MessageEvent("message", {
      data: {
        type: "OBSCUR_NOTIFICATION_CLICK",
        overlayAction: "open_chat",
      },
    });
    serviceWorkerMocks.container.dispatchEvent(messageEvent);

    expect(voiceOverlayActionBridgeMocks.dispatchVoiceCallOverlayAction).toHaveBeenCalledWith("open_chat");
  });
});
