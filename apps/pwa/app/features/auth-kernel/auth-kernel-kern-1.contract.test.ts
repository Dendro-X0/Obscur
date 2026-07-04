import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY } from "@dweb/auth";
import {
  deriveStartupAuthStateFromIdentityState,
  shouldEnterLoginModeOnStartup,
  shouldShowStoredIdentityLockScreen,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import {
  NATIVE_DEVICE_SESSION_CONSENT_ENABLED,
  NATIVE_SECURE_SESSION_RESTORE_ENABLED,
} from "@/app/features/auth/services/session-credential-policy";
import {
  isAuthKernelBootRestoreSettled,
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
  retryAuthKernelNativeSessionUnlock: vi.fn(async () => {
    mocks.identityStatus = "unlocked";
    return true;
  }),
}));

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => false,
  isDesktopShellBuild: () => true,
}));

describe("AUTH-KERN-1 desktop F5 boot restore gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    resetAuthKernelBootRestoreStateForTests();
    mocks.identityStatus = "locked";
    mocks.bootRestoreEnabled = true;
    mocks.hasNative = true;
    mocks.bootReconcileComplete = true;
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
  });

  it("tracks AUTH-KERN-1 band after product gate flip", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
  });

  it("enables desktop native session restore policy after KERN-1", () => {
    expect(NATIVE_SECURE_SESSION_RESTORE_ENABLED).toBe(true);
    expect(NATIVE_DEVICE_SESSION_CONSENT_ENABLED).toBe(true);
  });

  it("restored startup surface skips login mode and stored lock screen (F5 success)", () => {
    const startupState = deriveStartupAuthStateFromIdentityState({
      identityStatus: "unlocked",
      storedPublicKeyHex: publicKeyHex,
      unlockedPublicKeyHex: publicKeyHex,
      nativeSessionPublicKeyHex: publicKeyHex,
    });
    expect(startupState.kind).toBe("restored");
    expect(shouldEnterLoginModeOnStartup(startupState)).toBe(false);
    expect(shouldShowStoredIdentityLockScreen({
      startupState,
      isAutoLockLocked: false,
      identityStatus: "unlocked",
    })).toBe(false);
  });

  it("boot owner restores unlocked runtime via auth_boot_snapshot + native retry", async () => {
    resetAuthKernelBootRestoreStateForTests();
    mocks.identityStatus = "locked";

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(true);
    expect(mocks.invokeMock).toHaveBeenCalledWith(
      "auth_boot_snapshot",
      { expectedPubkeyHex: publicKeyHex, restoreEligible: true },
      { timeoutMs: 5_000 },
    );
    expect(isAuthKernelBootRestoreSettled()).toBe(true);
    expect(mocks.identityStatus).toBe("unlocked");
  });

  it("boot owner fails closed on identity mismatch without unlocking", async () => {
    resetAuthKernelBootRestoreStateForTests();
    mocks.identityStatus = "locked";
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: "tester1",
        phase: "mismatch",
        stored_public_key_hex: publicKeyHex,
        session_public_key_hex: "bb".repeat(32),
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(false);
    expect(mocks.identityStatus).toBe("locked");
  });

  it("boot owner no-ops when restore is disabled for profile", async () => {
    resetAuthKernelBootRestoreStateForTests();
    mocks.bootRestoreEnabled = false;

    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(false);
    expect(mocks.invokeMock).not.toHaveBeenCalled();
  });
});
