import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  applyCachedWindowProfileScope,
  applyWindowLabelProfileScope,
  desktopProfileRuntime,
  resetDesktopProfileRefreshState,
  resolveNativeWindowLabel,
} from "./desktop-profile-runtime";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { logAppEvent } from "@/app/shared/log-app-event";
import { startDesktopWindowBoot } from "./desktop-window-boot";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(),
}));

vi.mock("./desktop-profile-runtime", () => ({
  applyCachedWindowProfileScope: vi.fn(),
  applyDesktopWindowBootPayload: vi.fn(() => false),
  applyWindowLabelProfileScope: vi.fn(),
  resolveNativeWindowLabel: vi.fn(),
  resetDesktopProfileRefreshState: vi.fn(),
  desktopProfileRuntime: {
    refresh: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

vi.mock("./desktop-window-boot-payload", () => ({
  readDesktopWindowBootPayload: vi.fn(() => null),
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn().mockResolvedValue({ ok: true, value: null }),
}));

vi.mock("@/app/features/auth/services/native-session-bootstrap-retry", () => ({
  retryNativeSessionBootstrapAfterProfileReady: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("desktop-window-boot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as Window & { __obscurBootReady?: boolean }).__obscurBootReady = false;
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(resolveNativeWindowLabel).mockImplementation(() => new Promise(() => {}));
    vi.mocked(applyCachedWindowProfileScope).mockReturnValue(false);
    vi.mocked(applyWindowLabelProfileScope).mockReturnValue(true);
    vi.mocked(desktopProfileRuntime.refresh).mockResolvedValue({} as never);
    vi.mocked(desktopProfileRuntime.getSnapshot).mockReturnValue({
      currentWindow: { profileId: "profile-2" },
    } as never);
  });

  it("marks boot ready before native window label resolves", () => {
    startDesktopWindowBoot();

    expect(resetDesktopProfileRefreshState).toHaveBeenCalled();
    expect((window as Window & { __obscurBootReady?: boolean }).__obscurBootReady).toBe(true);
    expect(applyWindowLabelProfileScope).not.toHaveBeenCalled();
  });

  it("reveals secondary profile windows after label scope is applied", async () => {
    vi.mocked(resolveNativeWindowLabel).mockResolvedValue("profile-profile-2-1700000000000");

    startDesktopWindowBoot();

    await vi.waitFor(() => {
      expect(invokeNativeCommand).toHaveBeenCalledWith("window_reveal_current");
    });
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.desktop_window_boot_ready",
    }));
  });
});
