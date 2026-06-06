import React from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { ProfileSettingsTabPanelModelProvider } from "./profile-settings-tab-panel-model-provider";

const profileMocks = vi.hoisted(() => {
  let revision = 0;
  const revert = vi.fn(() => {
    revision += 1;
  });
  return {
    revision: () => revision,
    revert,
    useProfile: () => {
      revision += 1;
      return {
        state: {
          profile: {
            username: "",
            about: "",
            avatarUrl: "",
            nip05: "",
            inviteCode: "",
          },
        },
        setUsername: vi.fn(),
        setAbout: vi.fn(),
        setAvatarUrl: vi.fn(),
        setNip05: vi.fn(),
        setInviteCode: vi.fn(),
        save: vi.fn(),
        revert,
        reset: vi.fn(),
      };
    },
  };
});

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: profileMocks.useProfile,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: { publicKeyHex: null, privateKeyHex: null, stored: null, status: "locked" },
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-sync-snapshot", () => ({
  useAccountSyncSnapshot: () => ({}),
}));

vi.mock("@/app/features/profile/hooks/use-profile-publisher", () => ({
  useProfilePublisher: () => ({
    publishProfile: vi.fn(async () => true),
    getLastReportSnapshot: vi.fn(() => null),
    isPublishing: false,
    phase: "idle",
    lastReport: null,
    error: null,
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({ relayPool: {} }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-pool-ref", () => ({
  useRelayPoolRef: () => ({ current: {} }),
}));

vi.mock("@/app/features/invites/hooks/use-user-invite-code", () => ({
  useUserInviteCode: () => ({ inviteCode: null, isLoading: false }),
}));

describe("useProfileSettingsModel stability", () => {
  it("mounts without maximum update depth when profile hook identity churns (STAB-P1)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const view = render(
        <ProfileSettingsTabPanelModelProvider>
          <div data-testid="child" />
        </ProfileSettingsTabPanelModelProvider>,
      );

      for (let index = 0; index < 6; index += 1) {
        await act(async () => Promise.resolve());
        view.rerender(
          <ProfileSettingsTabPanelModelProvider>
            <div data-testid="child" />
          </ProfileSettingsTabPanelModelProvider>,
        );
      }

      const hookErrors = consoleErrorSpy.mock.calls.filter((call) => {
        const text = call.map((part) => String(part)).join(" ");
        return /Maximum update depth exceeded/i.test(text);
      });
      expect(hookErrors).toHaveLength(0);
      expect(profileMocks.revert.mock.calls.length).toBeLessThanOrEqual(1);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
