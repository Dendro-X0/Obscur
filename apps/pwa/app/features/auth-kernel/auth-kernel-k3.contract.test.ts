import { beforeEach, describe, expect, it } from "vitest";
import { createAuthKernelRegistrationPolicyPort } from "./auth-kernel-registration-policy-adapter";
import { evaluateAuthKernelRegistrationGate } from "./auth-kernel-registration-gate";
import { createAuthKernelPorts } from "./auth-kernel-ports";
import {
  readAuthKernelSybilTierOverride,
  writeAuthKernelSybilTierOverride,
} from "./auth-kernel-sybil-policy-config";

describe("auth-kernel K3 registration policy", () => {
  beforeEach(() => {
    writeAuthKernelSybilTierOverride(null);
  });

  it("exposes plane B registration policy port", () => {
    const ports = createAuthKernelPorts();
    expect(typeof ports.registrationPolicy.resolvePolicy).toBe("function");
    expect(typeof ports.registrationPolicy.evaluateRegistration).toBe("function");
  });

  it("defaults to tier B standard registration", async () => {
    const port = createAuthKernelRegistrationPolicyPort();
    const result = await port.resolvePolicy("tester1");
    expect(result.status).toBe("ok");
    expect(result.value?.registrationMode).toBe("standard");
  });

  it("requires PoW when steward sets tier C", async () => {
    writeAuthKernelSybilTierOverride("C");
    const gate = await evaluateAuthKernelRegistrationGate("tester1");
    expect(gate.evaluation.powRequired).toBe(true);
    expect(gate.powDifficulty).toBe("medium");
    expect(gate.throttled).toBe(false);
    expect(gate.retryAfterMs).toBe(0);
  });

  it("blocks create when steward sets tier D invite_required", async () => {
    writeAuthKernelSybilTierOverride("D");
    const gate = await evaluateAuthKernelRegistrationGate("tester1");
    expect(gate.evaluation.allowed).toBe(false);
    expect(gate.evaluation.inviteRequired).toBe(true);
  });
});
