import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityRecord } from "@dweb/core/identity-record";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createAuthKernelDeviceUnlockPort } from "./auth-kernel-device-unlock-adapter";
import { createAuthKernelIdentityRootPort } from "./auth-kernel-identity-root-adapter";
import { createAuthKernelPorts } from "./auth-kernel-ports";

const delegateMocks = vi.hoisted(() => ({
  readStoredIdentitySnapshot: vi.fn(),
  runAuthKernelCreateIdentity: vi.fn(),
  runAuthKernelImportIdentity: vi.fn(),
  runAuthKernelUnlockWithPassphrase: vi.fn(),
  runAuthKernelUnlockWithPrivateKey: vi.fn(),
  revokeAuthKernelDeviceUnlockMaterial: vi.fn(),
  AuthKernelProfileScopeError: class AuthKernelProfileScopeError extends Error {
    constructor(expected: string, requested: string) {
      super(`Profile scope mismatch: active=${expected}, requested=${requested}`);
      this.name = "AuthKernelProfileScopeError";
    }
  },
}));

vi.mock("@/app/features/auth/services/auth-kernel-legacy-delegates", () => delegateMocks);

const publicKeyHex = "aa".repeat(32) as PublicKeyHex;
const identityRecord: IdentityRecord = {
  encryptedPrivateKey: "encrypted",
  publicKeyHex,
  username: "tester1",
};

describe("auth-kernel K1 adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("identity root port reads stored snapshot via legacy bridge", async () => {
    delegateMocks.readStoredIdentitySnapshot.mockResolvedValue({
      profileId: "tester1",
      record: identityRecord,
      publicKeyHex,
    });
    const port = createAuthKernelIdentityRootPort();
    const result = await port.readStoredIdentity({ profileId: "tester1" });
    expect(result.status).toBe("ok");
    expect(result.value?.publicKeyHex).toBe(publicKeyHex);
  });

  it("identity root port maps profile scope errors to invalid_input", async () => {
    delegateMocks.readStoredIdentitySnapshot.mockRejectedValue(
      new delegateMocks.AuthKernelProfileScopeError("tester1", "tester2"),
    );
    const port = createAuthKernelIdentityRootPort();
    const result = await port.readStoredIdentity({ profileId: "tester2" });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("invalid_input");
  });

  it("device unlock port unlocks via legacy bridge", async () => {
    delegateMocks.runAuthKernelUnlockWithPassphrase.mockResolvedValue({
      publicKeyHex,
      staySignedInApplied: true,
    });
    const port = createAuthKernelDeviceUnlockPort();
    const result = await port.unlockWithPassphrase({
      profileId: "tester1",
      passphrase: "secret-passphrase",
      expectedPublicKeyHex: publicKeyHex,
      context: "unlock",
    });
    expect(result.status).toBe("ok");
    expect(result.value?.staySignedInApplied).toBe(true);
  });

  it("device unlock port maps incorrect password to invalid_passphrase", async () => {
    delegateMocks.runAuthKernelUnlockWithPassphrase.mockRejectedValue(new Error("Incorrect password"));
    const port = createAuthKernelDeviceUnlockPort();
    const result = await port.unlockWithPassphrase({
      profileId: "tester1",
      passphrase: "wrong",
      expectedPublicKeyHex: publicKeyHex,
      context: "unlock",
    });
    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("invalid_passphrase");
  });

  it("createAuthKernelPorts exposes plane A, C, and D ports", () => {
    const ports = createAuthKernelPorts();
    expect(typeof ports.identityRoot.readStoredIdentity).toBe("function");
    expect(typeof ports.deviceUnlock.unlockWithPassphrase).toBe("function");
    expect(typeof ports.deviceUnlock.revokeDeviceUnlockMaterial).toBe("function");
    expect(typeof ports.authAssistant.readEntry).toBe("function");
    expect(typeof ports.registrationPolicy.evaluateRegistration).toBe("function");
    expect(typeof ports.runtimeSession.readBootSnapshot).toBe("function");
  });
});
