import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isAuthKernelBootRestoreSettled,
  resetAuthKernelBootRestoreStateForTests,
  runAuthKernelBootRestore,
  waitForAuthKernelBootRestore,
} from "./auth-kernel-boot-owner";

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;

const mocks = vi.hoisted(() => ({
  identityStatus: "locked" as "locked" | "unlocked",
  hasStored: true,
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
  resolveIdentityScopeProfileId: () => "default",
}));

vi.mock("@/app/features/profiles/services/desktop-window-boot", () => ({
  isDesktopProfileBootReconcileComplete: () => mocks.bootReconcileComplete,
  DESKTOP_PROFILE_BOOT_RECONCILED_EVENT: "desktop-profile-boot-reconciled",
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  desktopProfileRuntime: {
    getSnapshot: () => ({ currentWindow: { profileId: "default" } }),
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
    stored: mocks.hasStored ? { publicKeyHex, username: "DemoUser" } : undefined,
  }),
  readStoredIdentitySnapshot: vi.fn(async () => ({
    record: { publicKeyHex, username: "DemoUser" },
    publicKeyHex,
  })),
  seedAuthKernelLockedIdentity: vi.fn(),
  retryAuthKernelNativeSessionUnlock: vi.fn(async () => {
    mocks.identityStatus = "unlocked";
    return true;
  }),
}));

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isMobileShellBuild: () => false,
  isDesktopShellBuild: () => true,
}));

describe("AUTH-KERN cold hydrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.identityStatus = "locked";
    mocks.hasStored = true;
    mocks.bootRestoreEnabled = true;
    mocks.hasNative = true;
    mocks.bootReconcileComplete = true;
    mocks.invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profile_id: "default",
        phase: "unlocked",
        stored_public_key_hex: publicKeyHex,
        session_public_key_hex: publicKeyHex,
        keychain_present: true,
        restore_eligible: true,
        at_unix_ms: 1,
      },
    });
    resetAuthKernelBootRestoreStateForTests();
  });

  it("starts unsettled on native cold so waiters do not skip restore", () => {
    expect(mocks.hasNative).toBe(true);
    expect(isAuthKernelBootRestoreSettled()).toBe(false);
  });

  it("waitForAuthKernelBootRestore drives unlock when unsettled on cold", async () => {
    expect(isAuthKernelBootRestoreSettled()).toBe(false);

    const unlocked = await waitForAuthKernelBootRestore(2_000);

    expect(unlocked).toBe(true);
    expect(mocks.identityStatus).toBe("unlocked");
    expect(isAuthKernelBootRestoreSettled()).toBe(true);
  });

  it("waitForAuthKernelBootRestore drives restore even without in-memory stored pubkey", async () => {
    mocks.hasStored = false;

    const unlocked = await waitForAuthKernelBootRestore(2_000);

    expect(unlocked).toBe(true);
    expect(mocks.identityStatus).toBe("unlocked");
  });

  it("runAuthKernelBootRestore unlocks when boot phase is already unlocked", async () => {
    const restored = await runAuthKernelBootRestore({ skipBootWait: true });
    expect(restored).toBe(true);
    expect(mocks.identityStatus).toBe("unlocked");
  });
});
