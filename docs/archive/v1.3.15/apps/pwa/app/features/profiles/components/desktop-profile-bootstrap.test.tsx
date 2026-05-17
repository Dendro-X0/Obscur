import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopProfileBootstrap, desktopProfileBootstrapInternals } from "./desktop-profile-bootstrap";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { logAppEvent } from "@/app/shared/log-app-event";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(),
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    refresh: vi.fn(),
    getLastRefreshError: vi.fn(),
    getSnapshot: vi.fn(),
  },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("DesktopProfileBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
    vi.mocked(desktopProfileRuntime.refresh).mockResolvedValue({} as any);
    vi.mocked(desktopProfileRuntime.getLastRefreshError).mockReturnValue(null);
    vi.mocked(desktopProfileRuntime.getSnapshot).mockReturnValue({
      currentWindow: { profileId: "default" },
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not block startup in non-native web runtime", async () => {
    render(
      <DesktopProfileBootstrap>
        <div>ready-content</div>
      </DesktopProfileBootstrap>
    );

    await waitFor(() => {
      expect(screen.getByText("ready-content")).toBeInTheDocument();
    });
    expect(desktopProfileRuntime.refresh).not.toHaveBeenCalled();
  });

  it("unblocks startup when native profile refresh hangs beyond bootstrap deadline", async () => {
    vi.useFakeTimers();
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(desktopProfileRuntime.refresh).mockImplementation(() => new Promise(() => {
      // Intentionally unresolved to simulate hanging native bridge.
    }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <DesktopProfileBootstrap>
        <div>ready-content</div>
      </DesktopProfileBootstrap>
    );

    expect(screen.queryByText("ready-content")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        desktopProfileBootstrapInternals.PROFILE_REFRESH_BOOTSTRAP_DEADLINE_MS + 10
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("ready-content")).toBeInTheDocument();
    expect(desktopProfileRuntime.refresh).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.profile_binding_refresh_timeout",
      level: "warn",
    }));
    warnSpy.mockRestore();
  });

  it("emits diagnostics when native profile refresh returns fallback with error", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);
    vi.mocked(desktopProfileRuntime.refresh).mockResolvedValue({} as any);
    vi.mocked(desktopProfileRuntime.getLastRefreshError).mockReturnValue("native profile snapshot failed");

    render(
      <DesktopProfileBootstrap>
        <div>ready-content</div>
      </DesktopProfileBootstrap>
    );

    await waitFor(() => {
      expect(screen.getByText("ready-content")).toBeInTheDocument();
    });

    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "runtime.profile_binding_refresh_failed",
      level: "warn",
    }));
  });
});
