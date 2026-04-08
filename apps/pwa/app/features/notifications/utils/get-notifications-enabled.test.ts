import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeCapabilities: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  getRuntimeCapabilities: runtimeMocks.getRuntimeCapabilities,
}));

import { getNotificationsEnabled } from "./get-notifications-enabled";

describe("getNotificationsEnabled", () => {
  beforeEach(() => {
    localStorage.clear();
    runtimeMocks.getRuntimeCapabilities.mockReturnValue({
      isNativeRuntime: false,
      isDesktop: false,
      isMobile: false,
      supportsNativeCrypto: false,
      supportsWindowControls: false,
      supportsNativeNotifications: false,
      supportsTor: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to enabled channels when no persisted preference exists in native runtimes", () => {
    runtimeMocks.getRuntimeCapabilities.mockReturnValue({
      isNativeRuntime: true,
      isDesktop: true,
      isMobile: false,
      supportsNativeCrypto: true,
      supportsWindowControls: true,
      supportsNativeNotifications: true,
      supportsTor: true,
    });

    expect(getNotificationsEnabled()).toEqual({
      enabled: true,
      channels: {
        dmMessages: true,
        mentionsReplies: true,
        invitesSystem: true,
      },
    });
  });

  it("keeps default disabled behavior in non-native runtimes with no persisted preference", () => {
    expect(getNotificationsEnabled()).toEqual({
      enabled: false,
      channels: {
        dmMessages: false,
        mentionsReplies: false,
        invitesSystem: false,
      },
    });
  });

  it("respects persisted disabled preference even in native runtimes", () => {
    runtimeMocks.getRuntimeCapabilities.mockReturnValue({
      isNativeRuntime: true,
      isDesktop: true,
      isMobile: false,
      supportsNativeCrypto: true,
      supportsWindowControls: true,
      supportsNativeNotifications: true,
      supportsTor: true,
    });
    localStorage.setItem("dweb.nostr.pwa.notifications.enabled", "0");

    expect(getNotificationsEnabled()).toEqual({
      enabled: false,
      channels: {
        dmMessages: false,
        mentionsReplies: false,
        invitesSystem: false,
      },
    });
  });
});
