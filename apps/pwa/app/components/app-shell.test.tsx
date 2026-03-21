import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";
import * as pageTransitionRecovery from "./page-transition-recovery";

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
  default: (props: any) => {
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
});
