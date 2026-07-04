import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w7 — legacy recovery snapshot subtraction", () => {
  it("recovery port defines published snapshot owner and legacy subscription gate", () => {
    const port = read("app/features/transport-kernel/transport-kernel-recovery-port.ts");
    expect(port).toContain("resolvePublishedRelayRecoverySnapshot");
    expect(port).toContain("shouldSubscribeLegacyRelayRecoverySnapshot");
    expect(port).toContain("resolveLegacyRelayRuntimePhase");
  });

  it("relay runtime supervisor subtracts legacy recovery snapshot path when authority is active", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("shouldSubscribeLegacyRelayRecoverySnapshot");
    expect(supervisor).toContain("resolvePublishedRelayRecoverySnapshot");
    expect(supervisor).toContain("resolveLegacyRelayRuntimePhase");
    expect(supervisor).not.toContain("const toPhase");
    expect(supervisor).toMatch(/shouldSubscribeLegacyRelayRecoverySnapshot\(\)/);
  });

  it("legacy recovery controller remains metrics refresh owner only", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("recoveryController.refreshSnapshot");
    expect(supervisor).toContain("shouldRunLegacyRelayRecoveryOrchestration");
  });

  it("w6 snapshot phase port remains separate from w7 recovery subtraction", () => {
    const snapshotPort = read("app/features/transport-kernel/transport-kernel-snapshot-port.ts");
    const recoveryPort = read("app/features/transport-kernel/transport-kernel-recovery-port.ts");
    expect(snapshotPort).toContain("resolveRelayRuntimePhaseForTransportKernel");
    expect(recoveryPort).not.toContain("resolveRelayRuntimePhaseForTransportKernel");
  });
});
