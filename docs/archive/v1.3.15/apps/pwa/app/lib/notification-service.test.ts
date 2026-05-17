import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeCapabilities: vi.fn(),
}));

const tauriApiMocks = vi.hoisted(() => ({
  getTauriAPI: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  getRuntimeCapabilities: runtimeMocks.getRuntimeCapabilities,
}));

vi.mock("@/app/features/desktop/utils/tauri-api", () => ({
  getTauriAPI: tauriApiMocks.getTauriAPI,
}));

import {
  getNotificationPermission,
  requestRuntimeNotificationPermission,
  showRuntimeNotification,
} from "./notification-service";

describe("notification-service", () => {
  const originalNotification = globalThis.Notification;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    runtimeMocks.getRuntimeCapabilities.mockReturnValue({
      supportsNativeNotifications: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalNotification) {
      vi.stubGlobal("Notification", originalNotification);
    }
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: originalServiceWorker,
    });
  });

  it("uses browser notification permission in web runtimes", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    class BrowserNotificationMock {
      static permission: NotificationPermission = "granted";
      static requestPermission = requestPermission;
      onclick: (() => void) | null = null;
      constructor(_title: string, _options?: NotificationOptions) {}
    }
    vi.stubGlobal("Notification", BrowserNotificationMock as unknown as typeof Notification);

    await expect(getNotificationPermission()).resolves.toBe("granted");
    await expect(requestRuntimeNotificationPermission()).resolves.toBe("granted");
  });

  it("uses tauri notification adapter in native runtimes", async () => {
    runtimeMocks.getRuntimeCapabilities.mockReturnValue({
      supportsNativeNotifications: true,
    });
    const show = vi.fn().mockResolvedValue(undefined);
    tauriApiMocks.getTauriAPI.mockReturnValue({
      notification: {
        isPermissionGranted: vi.fn().mockResolvedValue(true),
        requestPermission: vi.fn().mockResolvedValue("granted"),
        show,
      },
    });

    await expect(getNotificationPermission()).resolves.toBe("granted");
    await expect(showRuntimeNotification({ title: "Hello", body: "World" })).resolves.toEqual({
      ok: true,
      permission: "granted",
    });
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: "Hello", body: "World" }));
  });

  it("returns failure when browser notification permission is not granted", async () => {
    class BrowserNotificationMock {
      static permission: NotificationPermission = "denied";
      static requestPermission = vi.fn().mockResolvedValue("denied");
      onclick: (() => void) | null = null;
      constructor(_title: string, _options?: NotificationOptions) {}
    }
    vi.stubGlobal("Notification", BrowserNotificationMock as unknown as typeof Notification);

    await expect(showRuntimeNotification({ title: "Hello", body: "World", tag: "tag-1" })).resolves.toEqual({
      ok: false,
      permission: "denied",
    });
  });

  it("requests permission when browser permission is default", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    class BrowserNotificationMock {
      static permission: NotificationPermission = "default";
      static requestPermission = requestPermission;
      onclick: (() => void) | null = null;
      constructor(_title: string, _options?: NotificationOptions) {}
    }
    vi.stubGlobal("Notification", BrowserNotificationMock as unknown as typeof Notification);

    await expect(showRuntimeNotification({ title: "Hello", body: "World" })).resolves.toEqual({
      ok: true,
      permission: "granted",
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("uses service worker notification path when available", async () => {
    class BrowserNotificationMock {
      static permission: NotificationPermission = "granted";
      static requestPermission = vi.fn().mockResolvedValue("granted");
      onclick: (() => void) | null = null;
      constructor(_title: string, _options?: NotificationOptions) {}
    }
    vi.stubGlobal("Notification", BrowserNotificationMock as unknown as typeof Notification);
    const showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          showNotification,
        }),
      },
    });

    await expect(showRuntimeNotification({
      title: "Incoming call",
      body: "Room: dm-voice",
      tag: "obscur-call",
      data: { overlayAction: "open_chat", href: "/" },
      requireInteraction: true,
      actions: [
        { action: "accept", title: "Accept" },
        { action: "decline", title: "Decline" },
      ],
    })).resolves.toEqual({
      ok: true,
      permission: "granted",
    });

    expect(showNotification).toHaveBeenCalledWith("Incoming call", expect.objectContaining({
      body: "Room: dm-voice",
      tag: "obscur-call",
      data: { overlayAction: "open_chat", href: "/" },
      requireInteraction: true,
      actions: [
        { action: "accept", title: "Accept" },
        { action: "decline", title: "Decline" },
      ],
    }));
  });

  it("wires browser notification clicks to focus and callback", async () => {
    const onClick = vi.fn();
    class BrowserNotificationMock {
      static permission: NotificationPermission = "granted";
      static requestPermission = vi.fn().mockResolvedValue("granted");
      static lastInstance: BrowserNotificationMock | null = null;
      onclick: (() => void) | null = null;
      constructor(_title: string, _options?: NotificationOptions) {
        BrowserNotificationMock.lastInstance = this;
      }
    }
    vi.stubGlobal("Notification", BrowserNotificationMock as unknown as typeof Notification);
    const focusSpy = vi.spyOn(window, "focus").mockImplementation(() => undefined);

    await expect(showRuntimeNotification({ title: "Call", body: "Incoming", onClick })).resolves.toEqual({
      ok: true,
      permission: "granted",
    });

    BrowserNotificationMock.lastInstance?.onclick?.();

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
