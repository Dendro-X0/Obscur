import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  createStoredLockedStartupAuthState,
  shouldEnterLoginModeOnStartup,
} from "@/app/features/auth/services/startup-auth-state-contracts";
import {
  resetAuthKernelBootRestoreStateForTests,
  runAuthKernelBootRestore,
} from "./auth-kernel-boot-owner";
import { runAuthKernelSignOutCleanup } from "./auth-kernel-sign-out-cleanup";
import {
  isAuthKernelManualLockActive,
  markAuthKernelManualLock,
} from "./auth-kernel-manual-lock-state";

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;

const mocks = vi.hoisted(() => ({
  identityStatus: "locked" as "locked" | "unlocked",
  bootRestoreEnabled: true,
  hasNative: true,
  bootReconcileComplete: true,
  invokeMock: vi.fn(),
  retryUnlockMock: vi.fn(),
  deleteAssistantMock: vi.fn(),
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

vi.mock("./services/auth-assistant-vault-service", () => ({
  deleteAuthAssistantVaultPayload: (...args: unknown[]) => mocks.deleteAssistantMock(...args),
}));

describe("AUTH-KERN-3 sign out → F5 → auth screen", () => {
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
        keychain_present: false,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });
  });

  it("stored_locked startup routes to login without native restore path", () => {
    const startupState = createStoredLockedStartupAuthState({
      storedPublicKeyHex: publicKeyHex,
    });
    expect(startupState.kind).toBe("stored_locked");
    expect(startupState.kind).not.toBe("native_restorable");
    expect(shouldEnterLoginModeOnStartup(startupState)).toBe(true);
  });

  it("boot owner does not auto-restore when keychain is empty after sign out", async () => {
    const restored = await runAuthKernelBootRestore({ skipBootWait: true });

    expect(restored).toBe(false);
    expect(mocks.identityStatus).toBe("locked");
    expect(mocks.retryUnlockMock).not.toHaveBeenCalled();
  });

  it("sign-out cleanup clears auth-kernel auxiliary unlock material", async () => {
    markAuthKernelManualLock("tester1");

    await runAuthKernelSignOutCleanup("tester1");

    expect(isAuthKernelManualLockActive("tester1")).toBe(false);
    expect(mocks.deleteAssistantMock).toHaveBeenCalledWith("tester1");
  });
});
