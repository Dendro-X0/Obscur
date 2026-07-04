import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  AUTH_KERNEL_BOOT_RESTORE_ENABLED,
  isAuthKernelBootRestoreEnabled,
} from "./auth-kernel-policy";
import {
  createAuthKernelRuntimeSessionPort,
  mapAuthBootSnapshotWire,
} from "./auth-kernel-runtime-session-adapter";
import { createAuthKernelPorts } from "./auth-kernel-ports";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/app/features/auth/services/device-session-diagnostic-service", () => ({
  resolveDeviceSessionDiagnostic: vi.fn(async () => ({ kind: "ok" })),
}));

vi.mock("@/app/features/auth/services/native-device-session-lifecycle", () => ({
  clearInMemoryNativeSessionBestEffort: vi.fn(async () => undefined),
  endNativeDeviceSignInBestEffort: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/auth/services/session-api", () => ({
  SessionApi: {
    getSessionStatus: vi.fn(async () => ({
      isActive: true,
      npub: "aa".repeat(32),
      isNative: true,
    })),
    forceSessionRestore: vi.fn(async () => ({
      isActive: true,
      npub: "aa".repeat(32),
      isNative: true,
    })),
  },
}));

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;

describe("auth-kernel K2 runtime session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue({
      ok: true,
      value: {
        profileId: "tester1",
        phase: "unlocked",
        storedPublicKeyHex: publicKeyHex,
        sessionPublicKeyHex: publicKeyHex,
        keychainPresent: true,
        restoreEligible: true,
        atUnixMs: 1,
      },
    });
  });

  it("maps auth_boot_snapshot wire payload to AuthBootSnapshot", () => {
    const snapshot = mapAuthBootSnapshotWire({
      profile_id: "tester1",
      phase: "locked",
      stored_public_key_hex: publicKeyHex,
      keychain_present: true,
      restore_eligible: true,
      at_unix_ms: 42,
    });
    expect(snapshot.profileId).toBe("tester1");
    expect(snapshot.phase).toBe("locked");
    expect(snapshot.keychainPresent).toBe(true);
  });

  it("runtime session port calls auth_boot_snapshot with restoreEligible", async () => {
    const port = createAuthKernelRuntimeSessionPort();
    const result = await port.readBootSnapshot({
      profileId: "tester1",
      expectedPublicKeyHex: publicKeyHex,
      restoreEligible: true,
    });
    expect(result.status).toBe("ok");
    expect(invokeMock).toHaveBeenCalledWith(
      "auth_boot_snapshot",
      { expectedPubkeyHex: publicKeyHex, restoreEligible: true },
      { timeoutMs: 5_000 },
    );
  });

  it("createAuthKernelPorts exposes plane D runtime session port", () => {
    const ports = createAuthKernelPorts();
    expect(typeof ports.runtimeSession.readBootSnapshot).toBe("function");
    expect(typeof ports.runtimeSession.forceRestoreSession).toBe("function");
  });

  it("boot restore policy is enabled independently of legacy NATIVE_SECURE flag", () => {
    expect(AUTH_KERNEL_BOOT_RESTORE_ENABLED).toBe(true);
    expect(isAuthKernelBootRestoreEnabled("tester1")).toBe(true);
  });
});
