import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w8 — legacy recovery action orchestration subtraction", () => {
  it("recovery port defines orchestration gate and direct pool recovery", () => {
    const port = read("app/features/transport-kernel/transport-kernel-recovery-port.ts");
    expect(port).toContain("shouldRunLegacyRelayRecoveryOrchestration");
    expect(port).toContain("executeTransportKernelPoolRecovery");
    expect(port).not.toMatch(/relay-recovery-controller-legacy/);
  });

  it("relay runtime supervisor bypasses legacy triggerRecovery orchestration when authority is active", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("shouldRunLegacyRelayRecoveryOrchestration");
    expect(supervisor).toContain("executeTransportKernelPoolRecovery");
    expect(supervisor).toMatch(/shouldRunLegacyRelayRecoveryOrchestration\(\)[\s\S]*executeTransportKernelPoolRecovery/);
    expect(supervisor).toMatch(/scheduleAutoRecovery[\s\S]*shouldRunLegacyRelayRecoveryOrchestration/);
    expect(supervisor).toMatch(/startWarmup[\s\S]*shouldRunLegacyRelayRecoveryOrchestration/);
  });

  it("legacy recovery controller stays free of transport-kernel imports", () => {
    const controller = read("app/features/relays/services/relay-recovery-controller-legacy.ts");
    expect(controller).not.toContain("transport-kernel");
    expect(controller).toContain("buildTransportRecoverySnapshot");
  });

  it("w7 snapshot subtraction remains separate from w8 action orchestration gate", () => {
    const port = read("app/features/transport-kernel/transport-kernel-recovery-port.ts");
    expect(port).toContain("shouldSubscribeLegacyRelayRecoverySnapshot");
    expect(port).toContain("resolvePublishedRelayRecoverySnapshot");
    expect(port).toContain("shouldRunLegacyRelayRecoveryOrchestration");
  });
});
