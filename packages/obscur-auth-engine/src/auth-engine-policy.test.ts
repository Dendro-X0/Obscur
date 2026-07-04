import { describe, expect, it, vi } from "vitest";
import { createAuthEnginePorts, isAuthEngineAuthority } from "./auth-engine-policy";

describe("auth-engine policy", () => {
  it("is authority when KERN gates complete", () => {
    expect(isAuthEngineAuthority()).toBe(true);
  });

  it("assembles ports from host factories", () => {
    const identityRoot = { readStoredIdentity: vi.fn() };
    const registrationPolicy = { evaluateRegistration: vi.fn() };
    const deviceUnlock = { unlockWithPassphrase: vi.fn() };
    const authAssistant = { readVault: vi.fn() };
    const runtimeSession = { getSessionDiagnostic: vi.fn() };

    const ports = createAuthEnginePorts({
      identityRoot: () => identityRoot,
      registrationPolicy: () => registrationPolicy,
      deviceUnlock: () => deviceUnlock,
      authAssistant: () => authAssistant,
      runtimeSession: () => runtimeSession,
    });

    expect(ports.identityRoot).toBe(identityRoot);
    expect(ports.runtimeSession).toBe(runtimeSession);
  });
});
