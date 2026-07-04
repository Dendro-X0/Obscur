import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  createNativeRestorableStartupAuthState,
  shouldEnterLoginModeOnStartup,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import {
  markAuthKernelManualLock,
  clearAuthKernelManualLock,
} from "./auth-kernel-manual-lock-state";
import {
  resetAuthKernelBootRestoreStateForTests,
  runAuthKernelBootRestore,
} from "./auth-kernel-boot-owner";

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;

const mocks = vi.hoisted(() => ({
  identityStatus: "locked" as "locked" | "unlocked",
  bootRestoreEnabled: true,
  hasNative: true,
  bootReconcileComplete: true,
  invokeMock: vi.fn(),
  retryUnlockMock: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => mocks.hasNative,
}));

vi.mock("./auth-kernel-policy", async (importOriginal) => {
  const original = await importOriginal<typeof import("./auth-kernel-policy")>();
  return {
    ...original,
    isAuthKernelBootRestoreEnabled: () => mocks.bootRestoreEnabled,
  };
});

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  resolveIdentityScopeProfileId: () => "tester1",
}));

vi.mock("@/app/features/profiles/services/desktop-window-boot", () => ({
  isDesktopProfileBootReconcileComplete: () => mocks.bootReconcileComplete,
  DESKTOP_PROFILE_BOOT_RECONCILED_EVENT: "desktop-profile-boot-reconciled",
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    getSnapshot: () => ({ currentWindow: { profileId: "tester1" } }),
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
    stored: { publicKeyHex, username: "tester1" },
  }),
  rehydrateAuthKernelIdentityForActiveProfile: vi.fn(async () => undefined),
  retryAuthKernelNativeSessionUnlock: (...args: unknown[]) => mocks.retryUnlockMock(...args),
}));

describe("AUTH-KERN-2 lock → F5 → auth screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    resetAuthKernelBootRestoreStateForTests();
    mocks.identityStatus = "locked";
    mocks.bootRestoreEnabled = true;
    mocks.retryUnlockMock.mockResolvedValue(true);
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: "tester1",
        phase: "locked",
        stored_public_key_hex: publicKeyHex,
        session_public_key_hex: null,
        keychain_present: true,
        restore_eligible: false,
        at_unix_ms: 1,
      },
    });
  });

  it("native_restorable startup routes to login mode after manual lock F5", () => {
    const startupState = createNativeRestorableStartupAuthState({
      storedPublicKeyHex: publicKeyHex,
    });
    expect(startupState.kind).toBe("native_restorable");
    expect(shouldEnterLoginModeOnStartup(startupState)).toBe(true);
  });

  it("boot owner skips auto-restore when manual lock flag is set", async () => {
    markAuthKernelManualLock("tester1");

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(false);
    expect(mocks.identityStatus).toBe("locked");
    expect(mocks.invokeMock).toHaveBeenCalledWith(
      "auth_boot_snapshot",
      { expectedPubkeyHex: publicKeyHex, restoreEligible: false },
      { timeoutMs: 5_000 },
    );
    expect(mocks.retryUnlockMock).not.toHaveBeenCalled();
  });

  it("cleared manual lock allows KERN-1 style restore on next F5", async () => {
    markAuthKernelManualLock("tester1");
    clearAuthKernelManualLock("tester1");
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: "tester1",
        phase: "unlocked",
        stored_public_key_hex: publicKeyHex,
        session_public_key_hex: publicKeyHex,
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });
    mocks.retryUnlockMock.mockImplementation(async () => {
      mocks.identityStatus = "unlocked";
      return true;
    });

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(true);
    expect(mocks.invokeMock).toHaveBeenCalledWith(
      "auth_boot_snapshot",
      { expectedPubkeyHex: publicKeyHex, restoreEligible: true },
      { timeoutMs: 5_000 },
    );
    expect(mocks.retryUnlockMock).toHaveBeenCalledTimes(1);
  });
});
