import { describe, expect, it } from "vitest";
import { resolveAccountSyncUiPolicy } from "./account-sync-ui-policy";
import type { AccountSyncSnapshot } from "../account-sync-contracts";

const baseSnapshot: AccountSyncSnapshot = {
  publicKeyHex: "f".repeat(64) as any,
  status: "identity_only",
  portabilityStatus: "unknown",
  phase: "idle",
  message: "Idle",
};

describe("accountSyncUiPolicy", () => {
  it("shows restore progress while relay rehydrate phases are active", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_account_data",
      },
    });

    expect(policy).toEqual({
      showRestoreProgress: true,
      showMissingSharedDataWarning: false,
    });
  });

  it("shows missing shared data warning without blocking runtime access", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "ready",
        status: "identity_only",
        lastImportEvidence: {
          localBinding: false,
          relayProfileEventSeen: false,
          relayBackupEventSeen: false,
          checkedAtUnixMs: Date.now(),
        },
      },
    });

    expect(policy).toEqual({
      showRestoreProgress: false,
      showMissingSharedDataWarning: true,
    });
  });

  it("keeps all account sync overlays hidden when identity is locked", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: false,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_profile",
      },
    });

    expect(policy).toEqual({
      showRestoreProgress: false,
      showMissingSharedDataWarning: false,
    });
  });
});

