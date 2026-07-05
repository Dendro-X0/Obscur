import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";
import * as pageTransitionRecovery from "./page-transition-recovery";
import {
  NAVIGATION_QUIESCENCE_MS,
  resetNavigationPerformanceCoordinatorForTests,
} from "./navigation-performance-coordinator";
import { logAppEvent } from "@/app/shared/log-app-event";
import { NAV_ITEMS } from "../lib/navigation/nav-items";

const appShellMocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
  isDesktop: false,
  isMobileShellProduct: false,
  warmRouteNavigationTargets: vi.fn(async (router: { prefetch: (href: string) => void }, targets: ReadonlyArray<string>) => {
    for (const href of targets) {
      router.prefetch(href);
    }
    return targets.map((href) => ({ href, status: "fulfilled" as const }));
  }),
}));

vi.mock("./route-navigation-warmup", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./route-navigation-warmup")>();
  return {
    ...actual,
    warmRouteNavigationTargets: appShellMocks.warmRouteNavigationTargets,
    loadClientChunkSafely: vi.fn(async () => "fulfilled" as const),
  };
});

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

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => appShellMocks.isMobileShellProduct,
  isMobileShellProduct: () => appShellMocks.isMobileShellProduct,
  isDesktopShellBuild: () => appShellMocks.isDesktop,
  isDesktopShellProduct: () => appShellMocks.isDesktop,
}));

vi.mock("@/app/features/dm-kernel/dm-kernel-policy", () => ({
  isDmKernelAuthority: () => false,
}));

vi.mock("@/app/features/messaging/components/messaging-sidebar-relay-footer", () => ({
  MessagingSidebarRelayFooter: () => null,
}));

vi.mock("./relay-status-badge", () => ({
  RelayStatusBadge: () => <div data-testid="relay-status-badge" />,
}));

vi.mock("@/app/features/relays/components/relay-transport-shell-banner", () => ({
  RelayTransportShellBanner: () => null,
}));

vi.mock("./user-avatar-menu", () => ({
  UserAvatarMenu: () => <div data-testid="user-avatar-menu" />,
}));

vi.mock("./mobile-tab-bar", () => ({
  MobileTabBar: () => <div data-testid="mobile-tab-bar" />,
}));

vi.mock("./global-navigation-loading", () => ({
  useGlobalNavigationLoadingActions: () => ({
    beginNavigation: vi.fn(),
    beginChunkLoad: vi.fn(),
    endChunkLoad: vi.fn(),
  }),
  GlobalNavigationChunkLoadingBoundary: () => null,
}));

vi.mock("./app-loading-screen", () => ({
  AppLoadingScreen: () => <div>Loading</div>,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

vi.mock("@/app/features/runtime/experiment-shell-policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/runtime/experiment-shell-policy")>();
  return {
    ...actual,
    shouldDeferExperimentHeavyWork: () => false,
    shouldRunNavigationInstrumentation: () => true,
    shouldEnableNavigationProgressUx: () => true,
  };
});

const flushIntelligentWarmup = async (): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(NAVIGATION_QUIESCENCE_MS + 32);
  });
  await act(async () => {
    for (let step = 0; step < 48; step += 1) {
      await Promise.resolve();
      vi.runOnlyPendingTimers();
    }
  });
};

describe("AppShell navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNavigationPerformanceCoordinatorForTests();
    appShellMocks.pathname = "/";
    appShellMocks.isDesktop = false;
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      const handle = window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
      return handle;
    });
    vi.stubGlobal("cancelIdleCallback", (handle: number) => {
      window.clearTimeout(handle);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const handle = window.setTimeout(() => callback(performance.now()), 0);
      return handle;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      window.clearTimeout(handle);
    });
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

  it("warms navigation targets in phased order after mount", async () => {
    vi.useFakeTimers();
    try {
      await renderShell();
      await flushIntelligentWarmup();

    const warmedTargets = ["/network", "/vault", "/search", "/settings"];
    for (const href of warmedTargets) {
      expect(appShellMocks.prefetch).toHaveBeenCalledWith(href);
    }
    expect(appShellMocks.prefetch).not.toHaveBeenCalledWith("/");

    const warmupStartedLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
      event.name === "navigation.intelligent_warmup_started"
      && event.context?.routeSurface === "chats"
      && Number(event.context?.contextCount) === 1
      && Number(event.context?.backgroundCount) === 3
    ));
    const contextPhaseLogged = vi.mocked(logAppEvent).mock.calls.some(([event]) => (
      event.name === "navigation.intelligent_warmup_phase_completed"
      && event.context?.phase === "context"
      && event.context?.routeSurface === "chats"
    ));
    expect(warmupStartedLogged).toBe(true);
    expect(contextPhaseLogged).toBe(true);
    } finally {
      vi.useRealTimers();
      resetNavigationPerformanceCoordinatorForTests();
    }
  });

  it("auto-prefetches routes in desktop runtime after mount", async () => {
    vi.useFakeTimers();
    try {
      appShellMocks.isDesktop = true;
      await renderShell();
      await flushIntelligentWarmup();

      expect(appShellMocks.prefetch).toHaveBeenCalledWith("/network");
      expect(appShellMocks.prefetch).toHaveBeenCalledWith("/settings");
    } finally {
      vi.useRealTimers();
      appShellMocks.isDesktop = false;
      resetNavigationPerformanceCoordinatorForTests();
    }
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

  it("closes mobile navigation drawer after route change", async () => {
    const { rerender } = render(
      <AppShell hideSidebar={false}>
        <div>Content</div>
      </AppShell>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    });
    expect(screen.getByLabelText("Close navigation")).toBeInTheDocument();

    appShellMocks.pathname = "/network";
    rerender(
      <AppShell hideSidebar={false}>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByLabelText("Close navigation")).not.toBeInTheDocument();
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

  it("hides the mobile tab bar in DM-first mobile shell mode", async () => {
    render(
      <AppShell hideSidebar mobileDmMode>
        <div>Content</div>
      </AppShell>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByTestId("mobile-tab-bar")).not.toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("shows the mobile tab bar on mobile shell list routes when sidebar is hidden", async () => {
    appShellMocks.isMobileShellProduct = true;
    render(
      <AppShell hideSidebar mobileDmMode={false}>
        <div>Content</div>
      </AppShell>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("mobile-tab-bar")).toBeInTheDocument();
    appShellMocks.isMobileShellProduct = false;
  });
});
