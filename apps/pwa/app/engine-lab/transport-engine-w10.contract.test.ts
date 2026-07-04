import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w10 — headless engine runtime owner + pool port subtraction", () => {
  it("transport-kernel engine port owns createTransportEngine runtime", () => {
    const port = read("app/features/transport-kernel/transport-kernel-engine-port.ts");
    expect(port).toContain("createTransportEngine");
    expect(port).toContain("getTransportKernelEngine");
    expect(port).toContain("buildTransportKernelSupervisorEvidence");
    expect(port).toContain("isTransportKernelAuthority");
  });

  it("supervisor evidence delegates to transport-kernel engine when authority is active", () => {
    const evidence = read("app/features/relays/services/transport-relay-supervisor-evidence.ts");
    expect(evidence).toContain("buildTransportKernelSupervisorEvidence");
    expect(evidence).toContain("isTransportKernelAuthority");
    expect(evidence).toContain("buildTransportSnapshot");
  });

  it("relay runtime supervisor path uses relay-pool-runtime-port not enhanced-relay-pool legacy", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    const poolPort = read("app/features/relays/services/relay-pool-runtime-port.ts");
    expect(supervisor).toContain("relay-pool-runtime-port");
    expect(supervisor).toContain("RelayPoolRuntime");
    expect(supervisor).not.toContain("enhanced-relay-pool-legacy");
    expect(supervisor).not.toContain("enhanced-relay-pool-port");
    expect(poolPort).toContain("RelayPoolRuntime");
    expect(poolPort).not.toMatch(/enhanced-relay-pool-legacy/);
  });

  it("recovery and subscribe supervisor path imports use relay-pool-runtime-port", () => {
    const recoveryPort = read("app/features/relays/services/relay-recovery-port.ts");
    const subscribe = read("app/features/relays/services/transport-relay-pool-subscribe.ts");
    expect(recoveryPort).toContain("relay-pool-runtime-port");
    expect(subscribe).toContain("relay-pool-runtime-port");
    expect(recoveryPort).not.toContain("enhanced-relay-pool-types");
    expect(subscribe).not.toContain("enhanced-relay-pool-types");
  });
});
