import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSnapshot = vi.fn();
const rehydrateAccount = vi.fn();
const restoreEncryptedAccountBackup = vi.fn();
const loadFromStorage = vi.fn();

vi.mock("./account-sync-status-store", () => ({
  accountSyncStatusStore: {
    updateSnapshot,
  },
}));

vi.mock("./account-rehydrate-service", () => ({
  accountRehydrateService: {
    rehydrateAccount,
  },
}));

vi.mock("./encrypted-account-backup-service", () => ({
  encryptedAccountBackupService: {
    restoreEncryptedAccountBackup,
  },
}));

vi.mock("./account-projection-runtime", () => ({
  accountProjectionRuntime: {
    appendCanonicalEvents: vi.fn(),
  },
}));

vi.mock("./account-sync-chat-state-port", () => ({
  accountSyncChatStatePort: {
    load: vi.fn(() => null),
  },
}));

vi.mock("@/app/features/network/hooks/use-peer-trust", () => ({
  peerTrustInternals: {
    loadFromStorage,
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("runManualAccountSyncRestore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFromStorage.mockReturnValue({ acceptedPeers: [], mutedPeers: [], removedPeers: [] });
  });

  it("refuses restore when the pool has no open relays", async () => {
    const { runManualAccountSyncRestore } = await import("./account-sync-manual-intent");
    const result = await runManualAccountSyncRestore({
      publicKeyHex: "aa".repeat(32),
      privateKeyHex: "bb".repeat(32),
      pool: {
        connections: [{ url: "wss://nos.lol", status: "closed" }],
        waitForConnection: async () => false,
        sendToOpen: () => undefined,
        subscribeToMessages: () => () => undefined,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No open relays/i);
    expect(rehydrateAccount).not.toHaveBeenCalled();
    expect(restoreEncryptedAccountBackup).not.toHaveBeenCalled();
  });

  it("reports restored contact count after a successful apply", async () => {
    rehydrateAccount.mockResolvedValue({ relayList: [] });
    restoreEncryptedAccountBackup.mockResolvedValue({
      payload: { peerTrust: { acceptedPeers: ["cc".repeat(32)] } },
      hasBackup: true,
    });
    loadFromStorage.mockReturnValue({
      acceptedPeers: ["cc".repeat(32)],
      mutedPeers: [],
      removedPeers: [],
    });

    const { runManualAccountSyncRestore } = await import("./account-sync-manual-intent");
    const result = await runManualAccountSyncRestore({
      publicKeyHex: "aa".repeat(32),
      privateKeyHex: "bb".repeat(32),
      pool: {
        connections: [{ url: "wss://nos.lol", status: "open" }],
        waitForConnection: async () => true,
        sendToOpen: () => undefined,
        subscribeToMessages: () => () => undefined,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/1 trusted contact/i);
  });
});
