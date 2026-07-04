import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  claimActiveSessionLease,
  findActiveSessionLeaseForAccount,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import {
  markAuthKernelManualLock,
  isAuthKernelManualLockActive,
} from "./auth-kernel-manual-lock-state";
import { mapAuthBootSnapshotWire, createAuthKernelRuntimeSessionPort } from "./auth-kernel-runtime-session-adapter";
import {
  resetAuthKernelBootRestoreStateForTests,
  runAuthKernelBootRestore,
} from "./auth-kernel-boot-owner";
import { authKernelProfileScopeMatches } from "./auth-kernel-profile-scope";

const profileA = "alice";
const profileB = "bob";
const publicKeyA = "aa".repeat(32) as PublicKeyHex;
const publicKeyB = "bb".repeat(32) as PublicKeyHex;

const mocks = vi.hoisted(() => ({
  activeProfileId: "alice",
  identityStatus: "locked" as "locked" | "unlocked",
  bootRestoreEnabled: true,
  invokeMock: vi.fn(),
  retryUnlockMock: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("./auth-kernel-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth-kernel-policy")>();
  return {
    ...original,
    isAuthKernelBootRestoreEnabled: () => mocks.bootRestoreEnabled,
  };
});

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  resolveIdentityScopeProfileId: () => mocks.activeProfileId,
}));

vi.mock("@/app/features/profiles/services/desktop-window-boot", () => ({
  isDesktopProfileBootReconcileComplete: () => true,
  DESKTOP_PROFILE_BOOT_RECONCILED_EVENT: "desktop-profile-boot-reconciled",
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    getSnapshot: () => ({ currentWindow: { profileId: mocks.activeProfileId } }),
    bindCurrentWindowProfile: vi.fn(async () => undefined),
    refresh: vi.fn(async () => undefined),
  },
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: (...args: unknown[]) => mocks.invokeMock(...args),
}));

vi.mock("@/app/features/runtime/services/window-runtime-binding", () => ({
  reconcileWindowRuntimeBinding: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/auth/services/auth-kernel-legacy-delegates", () => ({
  getIdentitySnapshot: () => ({
    status: mocks.identityStatus,
    stored: {
      publicKeyHex: mocks.activeProfileId === profileA ? publicKeyA : publicKeyB,
      username: mocks.activeProfileId,
    },
  }),
  rehydrateAuthKernelIdentityForActiveProfile: vi.fn(async () => undefined),
  retryAuthKernelNativeSessionUnlock: (...args: unknown[]) => mocks.retryUnlockMock(...args),
}));

describe("AUTH-KERN-4 two profile windows — scoped keychain/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    resetAuthKernelBootRestoreStateForTests();
    mocks.activeProfileId = profileA;
    mocks.identityStatus = "locked";
    mocks.retryUnlockMock.mockResolvedValue(true);
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: profileA,
        phase: "unlocked",
        stored_public_key_hex: publicKeyA,
        session_public_key_hex: publicKeyA,
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });
  });

  it("manual lock flags are isolated per profile window", () => {
    markAuthKernelManualLock(profileA);
    expect(isAuthKernelManualLockActive(profileA)).toBe(true);
    expect(isAuthKernelManualLockActive(profileB)).toBe(false);
  });

  it("cross-profile active session lease blocks duplicate account in another window", () => {
    claimActiveSessionLease({
      publicKeyHex: publicKeyA,
      profileId: profileA,
      windowLabel: "main",
    });
    const conflict = findActiveSessionLeaseForAccount({
      publicKeyHex: publicKeyA,
      excludeProfileId: profileB,
    });
    expect(conflict?.profileId).toBe(profileA);
  });

  it("runtime session port rejects boot snapshot profile mismatch", async () => {
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: profileB,
        phase: "unlocked",
        stored_public_key_hex: publicKeyB,
        session_public_key_hex: publicKeyB,
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });
    const port = createAuthKernelRuntimeSessionPort();
    const result = await port.readBootSnapshot({
      profileId: profileA,
      expectedPublicKeyHex: publicKeyA,
      restoreEligible: true,
    });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("profile_scope_unresolved");
  });

  it("boot owner refuses restore when snapshot profile differs from window scope", async () => {
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: profileB,
        phase: "unlocked",
        stored_public_key_hex: publicKeyB,
        session_public_key_hex: publicKeyB,
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(false);
    expect(mocks.retryUnlockMock).not.toHaveBeenCalled();
    expect(authKernelProfileScopeMatches(profileA, profileB)).toBe(false);
  });

  it("maps boot snapshot wire with window-bound profile id", () => {
    const snapshot = mapAuthBootSnapshotWire({
      profile_id: profileA,
      phase: "locked",
      keychain_present: true,
      restore_eligible: true,
    });
    expect(snapshot.profileId).toBe(profileA);
  });
});
