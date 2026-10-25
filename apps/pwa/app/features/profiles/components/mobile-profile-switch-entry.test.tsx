import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileProfileSwitchEntry } from "./mobile-profile-switch-entry";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Readonly<{ slot?: string }>) => {
      if (key === "profiles.mobile.switchHint") {
        return `Profile slot · ${opts?.slot ?? ""} — tap to switch`;
      }
      if (key === "profiles.mobile.switchCta") {
        return "Switch";
      }
      if (key === "profiles.mobile.switchAria") {
        return "Switch or manage profiles on this device";
      }
      return key;
    },
  }),
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({
    state: {
      profile: {
        username: "DemoUser",
        avatarUrl: "",
      },
    },
  }),
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  useDesktopProfileIsolationSnapshot: () => ({
    currentWindow: {
      profileId: "default",
      profileLabel: "DemoUser",
      windowLabel: "main",
    },
    profiles: [],
  }),
}));

vi.mock("@/app/components/user-avatar", () => ({
  UserAvatar: () => <div data-testid="user-avatar" />,
}));

describe("MobileProfileSwitchEntry", () => {
  it("links to /profiles with current account label", () => {
    render(<MobileProfileSwitchEntry />);
    const link = screen.getByTestId("mobile-profile-switch-entry");
    expect(link).toHaveAttribute("href", "/profiles");
    expect(screen.getByText("DemoUser")).toBeInTheDocument();
    expect(screen.getByText(/tap to switch/i)).toBeInTheDocument();
  });
});
