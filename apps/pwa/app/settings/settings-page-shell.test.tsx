import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./settings-page-shell";

const settingsPageMocks = vi.hoisted(() => ({
  compactLayout: true,
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => ({
      "settings.title": "Settings",
      "settings.groups.general": "General",
      "settings.groups.account": "Account",
      "settings.groups.network": "Network",
      "settings.groups.moderation": "Moderation",
      "settings.groups.system": "System",
      "settings.tabs.profile": "Profile",
      "settings.tabs.appearance": "Appearance",
      "settings.tabs.notifications": "Notifications",
      "settings.tabs.identity": "Identity",
      "settings.tabs.security": "Security",
      "settings.tabs.relays": "Relays",
      "settings.tabs.storage": "Storage",
      "settings.tabs.blocklist": "Blocklist",
      "settings.tabs.privacy": "Privacy",
      "settings.tabs.updates": "Updates",
      "common.back": "Back",
    }[key] ?? fallback ?? key),
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => settingsPageMocks.searchParams,
  useRouter: () => ({
    replace: settingsPageMocks.replace,
  }),
  usePathname: () => "/settings",
}));

vi.mock("@/app/features/runtime/use-mobile-compact-layout", () => ({
  useMobileCompactLayout: () => settingsPageMocks.compactLayout,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => {
      return ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
    },
  }),
}));

vi.mock("@/app/components/app-chrome-registry", () => ({
  useRegisterAppChrome: vi.fn(),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
      stored: { publicKeyHex: "a".repeat(64) },
    },
  }),
}));

vi.mock("@/app/features/main-shell/hooks/use-nav-badges", () => ({
  default: () => ({
    navBadgeCounts: {},
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayRecovery: { readiness: "healthy" },
  }),
}));

vi.mock("@/app/features/settings/components/settings-search-field", () => ({
  SettingsSearchField: () => <input aria-label="settings-search" />,
}));

vi.mock("@/app/settings/components/settings-tab-panel-loader", () => ({
  SettingsTabPanel: ({ activeTab }: { activeTab: string }) => (
    <div data-testid="settings-tab-panel">{activeTab}</div>
  ),
}));

vi.mock("@/app/features/settings/services/settings-search-navigate", () => ({
  dispatchSettingsSearchPrepare: vi.fn(),
}));

vi.mock("@/app/shared/search-target-highlight", () => ({
  focusSearchTargetById: vi.fn(),
  settingsTabPanelElementId: (tab: string) => `settings-tab-panel-${tab}`,
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("SettingsPage mobile section nav", () => {
  beforeEach(() => {
    settingsPageMocks.compactLayout = true;
    settingsPageMocks.replace.mockReset();
    settingsPageMocks.searchParams = new URLSearchParams();
  });

  it("renders grouped mobile menu with a dedicated scroll region", () => {
    render(<SettingsPage />);

    const menuScroll = screen.getByTestId("settings-mobile-menu-scroll");
    expect(menuScroll).toHaveClass("mobile-scroll-region");
    expect(within(menuScroll).getByText("General")).toBeInTheDocument();
    expect(within(menuScroll).getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(screen.queryByTestId("settings-mobile-panel-scroll")).not.toBeInTheDocument();
  });

  it("opens a settings panel from the mobile menu and syncs the tab query", async () => {
    render(<SettingsPage />);

    const menuScroll = screen.getByTestId("settings-mobile-menu-scroll");
    fireEvent.click(within(menuScroll).getByRole("button", { name: "Relays" }));

    const panelScroll = await screen.findByTestId("settings-mobile-panel-scroll");
    expect(panelScroll).toHaveClass("mobile-scroll-region");
    expect(within(panelScroll).getByTestId("settings-tab-panel")).toHaveTextContent("relays");
    expect(within(panelScroll.parentElement as HTMLElement).getByRole("heading", { name: "Relays" })).toBeInTheDocument();
    expect(settingsPageMocks.replace).toHaveBeenCalledWith("/settings?tab=relays", { scroll: false });
  });

  it("returns to the mobile menu from the panel header back control", async () => {
    render(<SettingsPage />);

    const menuScroll = screen.getByTestId("settings-mobile-menu-scroll");
    fireEvent.click(within(menuScroll).getByRole("button", { name: "Appearance" }));
    const panelScroll = await screen.findByTestId("settings-mobile-panel-scroll");

    fireEvent.click(within(panelScroll.parentElement as HTMLElement).getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(screen.getByTestId("settings-mobile-menu-scroll")).toBeInTheDocument();
    });
    expect(settingsPageMocks.replace).toHaveBeenLastCalledWith("/settings", { scroll: false });
  });

  it("deep-links into a panel when ?tab= is present", async () => {
    settingsPageMocks.searchParams = new URLSearchParams("tab=security");

    render(<SettingsPage />);

    const panelScroll = await screen.findByTestId("settings-mobile-panel-scroll");
    expect(within(panelScroll).getByTestId("settings-tab-panel")).toHaveTextContent("security");
    expect(within(panelScroll.parentElement as HTMLElement).getByRole("heading", { name: "Security" })).toBeInTheDocument();
  });
});
