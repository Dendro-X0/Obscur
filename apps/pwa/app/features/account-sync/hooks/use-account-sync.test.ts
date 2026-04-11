import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountSyncSnapshot } from "../account-sync-contracts";

const ACCOUNT_PUBKEY = "a".repeat(64) as PublicKeyHex;
const ACCOUNT_PRIVKEY = "b".repeat(64) as PrivateKeyHex;

function createSnapshot(overrides: Partial<AccountSyncSnapshot> = {}): AccountSyncSnapshot {
  return {
    publicKeyHex: "a".repeat(64) as PublicKeyHex,
    status: "private_restored" as const,
    portabilityStatus: "portable" as const,
    phase: "ready",
    message: "ready",
    ...overrides,
  };
}

const mocks = vi.hoisted(() => {
  let snapshot = createSnapshot();
  const listeners = new Set<(next: any) => void>();
  let mutationListener: ((detail: { reason: string; atUnixMs: number }) => void) | null = null;

  const emitSnapshot = (next: any): void => {
    snapshot = next;
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    get snapshot() {
      return snapshot;
    },
    setSnapshot: (next: any) => emitSnapshot(next),
    triggerMutation: (reason: string = "chat_state_changed") => mutationListener?.({
      reason,
      atUnixMs: Date.now(),
    }),
    subscribeMutationMock: vi.fn((listener: (detail: { reason: string; atUnixMs: number }) => void) => {
      mutationListener = listener;
      return () => {
        if (mutationListener === listener) {
          mutationListener = null;
        }
      };
    }),
    getSettingsMock: vi.fn(() => ({ accountSyncConvergenceV091: false })),
    rehydrateAccountMock: vi.fn(),
    publishBackupMock: vi.fn(),
    restoreBackupMock: vi.fn(),
    accountSyncStatusStore: {
      getSnapshot: vi.fn(() => snapshot),
      subscribe: vi.fn((listener: (next: any) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      updateSnapshot: vi.fn((patch: Record<string, unknown>) => {
        emitSnapshot({
          ...snapshot,
          ...patch,
        });
        return snapshot;
      }),
      resetSnapshot: vi.fn((publicKeyHex: PublicKeyHex | null = null) => {
        emitSnapshot(createSnapshot({
          publicKeyHex,
          status: "identity_only",
          portabilityStatus: "unknown",
          phase: "idle",
          message: "Idle",
        }));
        return snapshot;
      }),
    },
  };
});

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: mocks.getSettingsMock,
  },
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  subscribeAccountSyncMutation: mocks.subscribeMutationMock,
}));

vi.mock("../services/account-rehydrate-service", () => ({
  accountRehydrateService: {
    rehydrateAccount: mocks.rehydrateAccountMock,
  },
}));

vi.mock("../services/encrypted-account-backup-service", () => ({
  encryptedAccountBackupService: {
    publishEncryptedAccountBackup: mocks.publishBackupMock,
    restoreEncryptedAccountBackup: mocks.restoreBackupMock,
  },
}));

vi.mock("../services/account-sync-status-store", () => ({
  accountSyncStatusStore: mocks.accountSyncStatusStore,
}));

vi.mock("../services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    appendCanonicalEvents: vi.fn(async () => undefined),
  },
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => "default",
}));

import { useAccountSync } from "./use-account-sync";

describe("useAccountSync convergence orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setSnapshot(createSnapshot());
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "identity_only",
    } as any);
    mocks.publishBackupMock.mockResolvedValue({
      publishResult: { status: "ok" },
    } as any);
    mocks.restoreBackupMock.mockResolvedValue({
      event: null,
      payload: { version: 1 },
      hasBackup: true,
      degradedReason: undefined,
    } as any);
  });

  it("runs startup fast-follow restore when convergence guard is enabled and cached backup exists", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: true });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "private_restored",
    } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupRestoreReason).toBe("startup_fast_follow");
  });

  it("records mutation fast-follow restore attempt after mutation-driven backup publish", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: true });
    mocks.restoreBackupMock
      .mockResolvedValueOnce({
        event: null,
        payload: null,
        hasBackup: false,
        degradedReason: undefined,
      } as any)
      .mockResolvedValue({
        event: null,
        payload: { version: 1 },
        hasBackup: true,
        degradedReason: undefined,
      } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.subscribeMutationMock).toHaveBeenCalledTimes(1);
    });
    mocks.publishBackupMock.mockClear();
    mocks.restoreBackupMock.mockClear();

    act(() => {
      mocks.triggerMutation();
    });

    await waitFor(() => {
      expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishReason).toBe("mutation");
    });
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishReason).toBe("mutation");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishResult).toBe("ok");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupRestoreReason).toBe("mutation_fast_follow");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupRestoreResult).toBe("skipped_cooldown");
  });

  it("publishes immediately for community membership mutations (no mutation cooldown)", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.subscribeMutationMock).toHaveBeenCalledTimes(1);
    });
    mocks.publishBackupMock.mockClear();

    act(() => {
      mocks.triggerMutation("community_membership_changed");
    });

    await waitFor(() => {
      expect(mocks.publishBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishReason).toBe("community_membership_changed");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishResult).toBe("ok");
  });

  it("publishes immediately for delete tombstone mutations (no mutation cooldown)", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.subscribeMutationMock).toHaveBeenCalledTimes(1);
    });
    mocks.publishBackupMock.mockClear();

    act(() => {
      mocks.triggerMutation("message_delete_tombstones_changed");
    });

    await waitFor(() => {
      expect(mocks.publishBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishReason).toBe("message_delete_tombstones_changed");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishResult).toBe("ok");
  });

  it("publishes immediately for DM history mutations (no mutation cooldown)", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.subscribeMutationMock).toHaveBeenCalledTimes(1);
    });
    mocks.publishBackupMock.mockClear();

    act(() => {
      mocks.triggerMutation("dm_history_changed");
    });

    await waitFor(() => {
      expect(mocks.publishBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishReason).toBe("dm_history_changed");
    expect(mocks.snapshot.convergenceDiagnostics?.lastBackupPublishResult).toBe("ok");
  });

  it("runs startup restore before startup publish even when convergence guard is disabled", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "private_restored",
    } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.publishBackupMock).toHaveBeenCalled();
  });

  it("suppresses startup publish when startup restore reports no backup", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "identity_only",
    } as any);
    mocks.restoreBackupMock.mockResolvedValue({
      event: null,
      payload: null,
      hasBackup: false,
      degradedReason: undefined,
    } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.publishBackupMock).not.toHaveBeenCalled();
  });

  it("suppresses startup publish when startup restore is degraded", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "identity_only",
    } as any);
    mocks.restoreBackupMock.mockResolvedValue({
      event: null,
      payload: null,
      hasBackup: true,
      degradedReason: "decrypt failed",
    } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.publishBackupMock).not.toHaveBeenCalled();
  });

  it("suppresses startup publish when startup restore fails", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: false });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "private_restored",
    } as any);
    mocks.restoreBackupMock.mockRejectedValue(new Error("restore failed"));

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    expect(mocks.publishBackupMock).not.toHaveBeenCalled();
  });

  it("suppresses mutation-driven backup publish while restore is in flight", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: true });
    mocks.rehydrateAccountMock.mockResolvedValue({
      relayList: [],
      restoreStatus: "private_restored",
    } as any);

    let resolveRestore: ((value: any) => void) | null = null;
    const pendingRestore = new Promise((resolve) => {
      resolveRestore = resolve;
    });
    mocks.restoreBackupMock.mockImplementation(() => pendingRestore as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalledTimes(1);
    });
    mocks.publishBackupMock.mockClear();

    await act(async () => {
      mocks.triggerMutation();
      await Promise.resolve();
    });

    expect(mocks.publishBackupMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveRestore?.({
        event: null,
        payload: { version: 1 },
        hasBackup: true,
        degradedReason: undefined,
      });
      await Promise.resolve();
    });
  });

  it("keeps startup recoverable when initial rehydrate fails and later restore applies", async () => {
    mocks.getSettingsMock.mockReturnValue({ accountSyncConvergenceV091: true });
    mocks.rehydrateAccountMock.mockRejectedValueOnce(new Error("relay offline"));
    mocks.restoreBackupMock.mockResolvedValue({
      event: null,
      payload: { version: 1 },
      hasBackup: true,
      degradedReason: undefined,
    } as any);

    renderHook(() => useAccountSync({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: {} as any,
      enabledRelayUrls: ["wss://relay.example"],
    }));

    await waitFor(() => {
      expect(mocks.restoreBackupMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mocks.snapshot.phase).toBe("ready");
      expect(mocks.snapshot.status).toBe("private_restored");
    });
  });
});
