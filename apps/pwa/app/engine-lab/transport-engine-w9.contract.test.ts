import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w9 — relay recovery controller quarantined behind port", () => {
  it("legacy controller lives in relay-recovery-controller-legacy and is web-only", () => {
    const legacy = read("app/features/relays/services/relay-recovery-controller-legacy.ts");
    expect(legacy).toContain("createWebLegacyRelayRecoveryController");
    expect(legacy).toContain("buildTransportRecoverySnapshot");
    expect(legacy).toContain("Web-only legacy");
  });

  it("relay-recovery-port is the sole importer of legacy controller", () => {
    const port = read("app/features/relays/services/relay-recovery-port.ts");
    expect(port).toContain("relay-recovery-controller-legacy");
    expect(port).toContain("createRelayRecoveryRuntime");
    expect(port).toContain("relay-recovery-metrics-refresher");
    expect(port).toContain("shouldRunLegacyRelayRecoveryOrchestration");
    expect(port).not.toMatch(/@\/app\/legacy\//);
  });

  it("relay runtime supervisor uses createRelayRecoveryRuntime from port", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("createRelayRecoveryRuntime");
    expect(supervisor).not.toContain("relay-recovery-controller-legacy");
    expect(supervisor).not.toContain("createLegacyRelayRecoveryController");
  });

  it("w8 recovery orchestration subtraction remains on transport-kernel recovery port", () => {
    const recoveryPort = read("app/features/transport-kernel/transport-kernel-recovery-port.ts");
    const relayPort = read("app/features/relays/services/relay-recovery-port.ts");
    expect(recoveryPort).toContain("executeTransportKernelPoolRecovery");
    expect(relayPort).not.toContain("executeTransportKernelPoolRecovery");
  });
});
