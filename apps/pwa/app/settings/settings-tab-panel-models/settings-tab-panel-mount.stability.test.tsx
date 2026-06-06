import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SETTINGS_VALID_TABS } from "../settings-nav";
import { useSettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { ProfileSettingsTabPanelModelProvider } from "./profile-settings-tab-panel-model-provider";
import { IdentitySettingsTabPanelModelProvider } from "./identity-settings-tab-panel-model-provider";
import { SecuritySettingsTabPanelModelProvider } from "./security-settings-tab-panel-model-provider";
import { RelaysSettingsTabPanelModelProvider } from "./relays-settings-tab-panel-model-provider";
import { StorageSettingsTabPanelModelProvider } from "./storage-settings-tab-panel-model-provider";
import { AppearanceSettingsTabPanelModelProvider } from "./appearance-settings-tab-panel-model-provider";
import { NotificationsSettingsTabPanelModelProvider } from "./notifications-settings-tab-panel-model-provider";
import { BlocklistSettingsTabPanelModelProvider } from "./blocklist-settings-tab-panel-model-provider";
import { PrivacySettingsTabPanelModelProvider } from "./privacy-settings-tab-panel-model-provider";
import { UpdatesSettingsTabPanelModelProvider } from "./updates-settings-tab-panel-model-provider";

const providerByTab = {
  profile: ProfileSettingsTabPanelModelProvider,
  identity: IdentitySettingsTabPanelModelProvider,
  security: SecuritySettingsTabPanelModelProvider,
  relays: RelaysSettingsTabPanelModelProvider,
  storage: StorageSettingsTabPanelModelProvider,
  appearance: AppearanceSettingsTabPanelModelProvider,
  notifications: NotificationsSettingsTabPanelModelProvider,
  blocklist: BlocklistSettingsTabPanelModelProvider,
  privacy: PrivacySettingsTabPanelModelProvider,
  updates: UpdatesSettingsTabPanelModelProvider,
} as const;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en", changeLanguage: vi.fn() } }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      status: "unlocked",
      publicKeyHex: "a".repeat(64),
      privateKeyHex: "b".repeat(64),
      stored: { publicKeyHex: "a".repeat(64) },
    },
    lock: vi.fn(),
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: { connections: [], healthMetrics: [] },
    relayList: { state: { relays: [] } },
    relayRuntime: {
      writableRelayCount: 0,
      subscribableRelayCount: 0,
      phase: "offline",
      recoveryStage: "none",
      lastInboundEventAtUnixMs: 0,
      fallbackRelayUrls: [],
    },
    relayRecovery: { readiness: "degraded" },
    relayStatus: { total: 0, openCount: 0, errorCount: 0, coolingDownRelayCount: 0 },
    enabledRelayUrls: [],
    triggerRelayRecovery: vi.fn(),
    relaySelection: {},
    setRelayTransportMode: vi.fn(),
  }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-pool-ref", () => ({
  useRelayPoolRef: (pool: unknown) => ({ current: pool }),
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfile: () => ({
    state: { profile: { username: "", about: "", avatarUrl: "", nip05: "", inviteCode: "" } },
    setUsername: vi.fn(),
    setAbout: vi.fn(),
    setAvatarUrl: vi.fn(),
    setNip05: vi.fn(),
    setInviteCode: vi.fn(),
    save: vi.fn(),
    revert: vi.fn(),
    reset: vi.fn(),
  }),
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

vi.mock("@/app/features/account-sync/hooks/use-account-sync-snapshot", () => ({
  useAccountSyncSnapshot: () => ({}),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({ projection: null, accountProjectionReady: true }),
}));

vi.mock("@/app/features/invites/hooks/use-user-invite-code", () => ({
  useUserInviteCode: () => ({ inviteCode: null, isLoading: false }),
}));

vi.mock("@/app/features/network/hooks/use-blocklist", () => ({
  useBlocklist: () => ({
    state: { blockedPublicKeys: [] },
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  }),
}));

vi.mock("@/app/features/settings/hooks/use-theme", () => ({
  useTheme: () => ({ preference: "system", setPreference: vi.fn() }),
}));

vi.mock("@/app/features/settings/hooks/use-accessibility-preferences", () => ({
  useAccessibilityPreferences: () => ({
    textScale: "default",
    setTextScale: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: () => ({}),
    saveSettings: vi.fn(),
  },
}));

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: { getSnapshot: vi.fn(() => ({ projection: null, profileId: "default" })) },
}));

vi.mock("@/app/features/account-sync/services/encrypted-account-backup-service", () => ({
  encryptedAccountBackupService: {},
}));

function SharedModelProbe(): React.JSX.Element {
  const model = useSettingsTabPanelModel();
  expect(typeof model.deriveRelayRuntimeStatus).toBe("function");
  expect(typeof model.deriveRelayNodeStatus).toBe("function");
  expect(model.relayRuntimeStatus).toBeTruthy();
  expect(typeof model.relayRuntimeStatus.status).toBe("string");
  return <div data-testid="settings-model-probe" />;
}

describe("settings tab model providers (STAB-SETTINGS-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(SETTINGS_VALID_TABS)("mounts %s provider with shared relay runtime model", (tabId) => {
    const Provider = providerByTab[tabId];
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <Provider>
          <SharedModelProbe />
        </Provider>,
      );
      expect(screen.getByTestId("settings-model-probe")).toBeInTheDocument();
      const hookErrors = consoleErrorSpy.mock.calls.filter((call) => {
        const text = call.map((part) => String(part)).join(" ");
        return /Maximum update depth exceeded|is not defined|Cannot read properties of undefined/i.test(text);
      });
      expect(hookErrors).toHaveLength(0);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
