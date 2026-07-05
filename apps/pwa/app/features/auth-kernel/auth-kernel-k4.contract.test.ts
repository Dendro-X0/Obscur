import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createAuthKernelAssistantPort } from "./auth-kernel-assistant-adapter";
import { createAuthKernelPorts } from "./auth-kernel-ports";

const invokeMock = vi.hoisted(() => vi.fn());
const boundUnlockMock = vi.hoisted(() => vi.fn(async () => undefined));
const consentMock = vi.hoisted(() => vi.fn());
const publicKeyHex = vi.hoisted(() => "aa".repeat(32) as PublicKeyHex);

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/app/features/auth/services/auth-kernel-legacy-delegates", () => ({
  AuthKernelProfileScopeError: class AuthKernelProfileScopeError extends Error {},
}));

vi.mock("./auth-kernel-bound-profile-auth", () => ({
  runAuthKernelBoundProfileUnlockWithPassphrase: () => boundUnlockMock(),
}));

vi.mock("@/app/features/auth/services/device-session-consent", () => ({
  readDeviceSessionConsent: (...args: unknown[]) => consentMock(...args),
}));

const vaultPayload = JSON.stringify({
  version: 1,
  username: "tester1",
  passphrase: "secret-passphrase",
});

describe("auth-kernel K4 auth assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consentMock.mockReturnValue(true);
    boundUnlockMock.mockResolvedValue(undefined);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "auth_login_assist_read") {
        return { ok: true, value: vaultPayload };
      }
      if (command === "request_biometric_auth") {
        return { ok: true, value: false };
      }
      return { ok: true, value: null };
    });
  });

  it("exposes auth assistant port on kernel ports", () => {
    const ports = createAuthKernelPorts();
    expect(typeof ports.authAssistant.readEntry).toBe("function");
    expect(typeof ports.authAssistant.unlockWithAssistantGesture).toBe("function");
  });

  it("readEntry returns metadata without passphrase", async () => {
    const port = createAuthKernelAssistantPort();
    const result = await port.readEntry("tester1");
    expect(result.status).toBe("ok");
    expect(result.value?.username).toBe("tester1");
    expect(result.value?.hasSavedUnlock).toBe(true);
    expect(result.value).not.toHaveProperty("passphrase");
  });

  it("unlockWithAssistantGesture uses assistant context and never surfaces passphrase to caller", async () => {
    const port = createAuthKernelAssistantPort();
    const result = await port.unlockWithAssistantGesture({
      profileId: "tester1",
      expectedPublicKeyHex: publicKeyHex,
    });
    expect(result.status).toBe("ok");
    expect(boundUnlockMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        profileId: "tester1",
        passphrase: "secret-passphrase",
        expectedPublicKeyHex: publicKeyHex,
        staySignedIn: true,
      }),
    );
  });

  it("saveUnlockMaterial writes encoded payload to native vault", async () => {
    const port = createAuthKernelAssistantPort();
    const result = await port.saveUnlockMaterial({
      profileId: "tester1",
      username: "tester1",
      passphrase: "secret-passphrase",
    });
    expect(result.status).toBe("ok");
    expect(invokeMock).toHaveBeenCalledWith(
      "auth_login_assist_write",
      expect.objectContaining({
        profileId: "tester1",
        payload: vaultPayload,
      }),
    );
  });
});
