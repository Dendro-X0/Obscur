import { describe, expect, it } from "vitest";
import {
  isAccountDataLoading,
  resolveAccountSyncUiPolicy,
} from "./account-sync-ui-policy";
import type { AccountSyncSnapshot } from "../account-sync-contracts";
import type { AccountProjectionRuntimeSnapshot } from "../account-event-contracts";

const baseSnapshot: AccountSyncSnapshot = {
  publicKeyHex: "f".repeat(64) as any,
  status: "identity_only",
  portabilityStatus: "unknown",
  phase: "idle",
  message: "Idle",
};

const baseProjectionSnapshot: AccountProjectionRuntimeSnapshot = {
  profileId: "default",
  accountPublicKeyHex: "f".repeat(64) as any,
  projection: null,
  phase: "ready",
  status: "ready",
  accountProjectionReady: true,
  driftStatus: "unknown",
  updatedAtUnixMs: 1,
};

describe("accountSyncUiPolicy", () => {
  it("shows restore progress while relay rehydrate phases are active", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_account_data",
      },
      projectionSnapshot: baseProjectionSnapshot,
      hasVisibleConversations: true,
    });

    expect(policy).toEqual({
      showRestoreProgress: true,
      showMissingSharedDataWarning: false,
      showInitialHistorySyncNotice: false,
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
      projectionSnapshot: baseProjectionSnapshot,
      hasVisibleConversations: true,
    });

    expect(policy).toEqual({
      showRestoreProgress: false,
      showMissingSharedDataWarning: true,
      showInitialHistorySyncNotice: false,
    });
  });

  it("keeps all account sync overlays hidden when identity is locked", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: false,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_profile",
      },
      projectionSnapshot: baseProjectionSnapshot,
      hasVisibleConversations: false,
    });

    expect(policy).toEqual({
      showRestoreProgress: false,
      showMissingSharedDataWarning: false,
      showInitialHistorySyncNotice: false,
    });
  });

  it("suppresses restore progress for returning local-device profile windows", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_account_data",
      },
      projectionSnapshot: baseProjectionSnapshot,
      hasVisibleConversations: true,
      hasLocalReturningUserEvidence: true,
    });

    expect(policy.showRestoreProgress).toBe(false);
    expect(policy.showInitialHistorySyncNotice).toBe(false);
  });

  it("shows initial history sync notice when projection is still bootstrapping and sidebar is empty", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "ready",
        status: "public_restored",
        lastRestoreSource: "encrypted_backup",
      },
      projectionSnapshot: {
        ...baseProjectionSnapshot,
        phase: "bootstrapping",
        status: "pending",
        accountProjectionReady: false,
      },
      hasVisibleConversations: false,
    });

    expect(policy.showInitialHistorySyncNotice).toBe(true);
  });

  it("detects account data loading during restore and projection replay", () => {
    const policy = resolveAccountSyncUiPolicy({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_account_data",
      },
      projectionSnapshot: baseProjectionSnapshot,
      hasVisibleConversations: true,
    });

    expect(isAccountDataLoading({
      isIdentityUnlocked: true,
      snapshot: {
        ...baseSnapshot,
        phase: "restoring_account_data",
      },
      projectionSnapshot: baseProjectionSnapshot,
      accountSyncUiPolicy: policy,
    })).toBe(true);

    expect(isAccountDataLoading({
      isIdentityUnlocked: true,
      snapshot: baseSnapshot,
      projectionSnapshot: {
        ...baseProjectionSnapshot,
        phase: "bootstrapping",
        accountProjectionReady: false,
      },
      accountSyncUiPolicy: resolveAccountSyncUiPolicy({
        isIdentityUnlocked: true,
        snapshot: baseSnapshot,
        projectionSnapshot: {
          ...baseProjectionSnapshot,
          phase: "bootstrapping",
          accountProjectionReady: false,
        },
        hasVisibleConversations: true,
      }),
    })).toBe(true);
  });
});
