import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";
import * as pageTransitionRecovery from "./page-transition-recovery";
import { logAppEvent } from "@/app/shared/log-app-event";

const appShellMocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
  isDesktop: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => appShellMocks.pathname,
  useRouter: () => ({
    push: appShellMocks.push,
    replace: appShellMocks.replace,
    refresh: appShellMocks.refresh,
    prefetch: appShellMocks.prefetch,
  }),
}));

vi.mock("next/link", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
    const { href, onClick, children, ...rest } = props;
    return (
      <a
        href={typeof href === "string" ? href : ""}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
        }}
        {...rest}
      >
        {children}
      </a>
    );
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/app/features/desktop/hooks/use-tauri", () => ({
  useIsDesktop: () => appShellMocks.isDesktop,
}));

vi.mock("@/app/features/desktop/hooks/use-keyboard-shortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock("@/app/features/desktop/hooks/use-desktop-layout", () => ({
  useDesktopLayout: () => undefined,
}));

vi.mock("./relay-status-badge", () => ({
  RelayStatusBadge: () => <div data-testid="relay-status-badge" />,
}));

vi.mock("./user-avatar-menu", () => ({
  UserAvatarMenu: () => <div data-testid="user-avatar-menu" />,
}));

vi.mock("./mobile-tab-bar", () => ({
  MobileTabBar: () => <div data-testid="mobile-tab-bar" />,
}));

vi.mock("./app-loading-screen", () => ({
  AppLoadingScreen: () => <div>Loading</div>,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("AppShell navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appShellMocks.pathname = "/";
    appShellMocks.isDesktop = false;
  });

  const renderShell = async (
    props: Readonly<{
      navBadgeCounts?: Record<string, number>;
    }> = {},
  ) => {
    render(
      <AppShell hideSidebar={false} navBadgeCounts={props.navBadgeCounts}>
        <div>Content</div>
      </AppShell>,
    );
    await act(async () => {
      await Promise.resolve();
    });
  };

  it("renders sidebar links with native href targets", async () => {
    await renderShell();

    expect(screen.getByRole("link", { name: "nav.chats" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "nav.network" })).toHaveAttribute("href", "/network");
    expect(screen.getByRole("link", { name: "nav.settings" })).toHaveAttribute("href", "/settings");
  });

  it("marks the active route in sidebar", async () => {
    appShellMocks.pathname = "/network";
    await renderShell();

    expect(screen.getByRole("link", { name: "nav.network" }).className).toContain("bg-purple-500/10");
    expect(screen.getByRole("link", { name: "nav.chats" }).className).not.toContain("bg-purple-500/10");
  });

  it("renders unread badge counts", async () => {
    await renderShell({ navBadgeCounts: { "/": 120 } });

    expect(screen.getByLabelText("nav.chats unread count 120")).toHaveTextContent("99+");
  });

  it("hard-navigates when route transition stalls past watchdog timeout", async () => {
    vi.useFakeTimers();
    const hardNavigateSpy = vi.spyOn(pageTransitionRecovery, "hardNavigate").mockImplementation(() => undefined);
    try {
      await renderShell();
      const networkLink = screen.getByRole("link", { name: "nav.network" });
      act(() => {
        fireEvent.click(networkLink);
      });
      expect(hardNavigateSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(4_600);
      });
      expect(hardNavigateSpy).toHaveBeenCalledWith("/network");
    } finally {
      hardNavigateSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("logs app-shell route guard source when requesting navigation", async () => {
    await renderShell();
    const networkLink = screen.getByRole("link", { name: "nav.network" });
    act(() => {
      fireEvent.click(networkLink);
    });
    const routeRequestLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
      event.name === "navigation.route_request"
      && event.context?.guardSource === "app_shell"
      && event.context?.fromRouteSurface === "chats"
      && event.context?.targetRouteSurface === "network"
      && event.context?.targetHref === "/network"
    ));
    expect(routeRequestLogged).toBe(true);
  });

  it("uses escape key to navigate back when no dismissable layer is open", async () => {
    appShellMocks.pathname = "/network";
    window.history.pushState({}, "", "/");
    window.history.pushState({}, "", "/network");
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    try {
      await renderShell();
      act(() => {
        fireEvent.keyDown(window, { key: "Escape" });
      });
      expect(backSpy).toHaveBeenCalledTimes(1);
    } finally {
      backSpy.mockRestore();
    }
  });

  it("does not trigger shell escape-back while a dismissable layer is open", async () => {
    appShellMocks.pathname = "/network";
    const layer = document.createElement("div");
    layer.setAttribute("data-escape-layer", "open");
    document.body.appendChild(layer);
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    try {
      await renderShell();
      act(() => {
        fireEvent.keyDown(window, { key: "Escape" });
      });
      expect(backSpy).not.toHaveBeenCalled();
    } finally {
      backSpy.mockRestore();
      document.body.removeChild(layer);
    }
  });

  it("emits a slow route-mount probe event when settle threshold is exceeded", async () => {
    vi.useFakeTimers();
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    try {
      await renderShell();
      act(() => {
        vi.advanceTimersByTime(pageTransitionRecovery.ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 20);
      });
      const slowProbeLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
        event.name === "navigation.route_mount_probe_slow"
        && event.context?.routeSurface === "chats"
      ));
      expect(slowProbeLogged).toBe(true);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("enables route-mount performance guard after consecutive slow settles", async () => {
    vi.useFakeTimers();
    const animationFrameQueue: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationFrameQueue.push(callback);
      return animationFrameQueue.length;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    try {
      const { rerender } = render(
        <AppShell hideSidebar={false}>
          <div>Content</div>
        </AppShell>,
      );
      await act(async () => {
        await Promise.resolve();
      });

      const flushAnimationFrames = () => {
        let safetyCounter = 0;
        while (animationFrameQueue.length > 0 && safetyCounter < 16) {
          const callback = animationFrameQueue.shift();
          act(() => {
            callback?.(0);
          });
          safetyCounter += 1;
        }
      };

      const runSlowSettleCycle = async () => {
        act(() => {
          vi.advanceTimersByTime(pageTransitionRecovery.ROUTE_MOUNT_PROBE_WARN_THRESHOLD_MS + 20);
        });
        flushAnimationFrames();
        await act(async () => {
          await Promise.resolve();
        });
      };

      await runSlowSettleCycle();
      appShellMocks.pathname = "/network";
      rerender(
        <AppShell hideSidebar={false}>
          <div>Content</div>
        </AppShell>,
      );
      await runSlowSettleCycle();

      appShellMocks.pathname = "/settings";
      rerender(
        <AppShell hideSidebar={false}>
          <div>Content</div>
        </AppShell>,
      );
      await runSlowSettleCycle();

      const guardEnabledLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
        event.name === "navigation.route_mount_performance_guard_enabled"
        && event.context?.routeSurface === "settings"
      ));
      const transitionsDisabledLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
        event.name === "navigation.page_transition_effects_disabled"
        && event.context?.disableReason === "route_mount_consecutive_slow"
      ));
      expect(guardEnabledLogged).toBe(true);
      expect(transitionsDisabledLogged).toBe(true);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
