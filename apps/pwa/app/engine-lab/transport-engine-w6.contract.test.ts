import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w6 — transport snapshot owner authority flip", () => {
  it("transport-kernel policy flips native authority like dm-kernel", () => {
    const policy = read("app/features/transport-kernel/transport-kernel-policy.ts");
    expect(policy).toContain("isEngineLabStrictMode");
    expect(policy).toContain("requiresSqlitePersistence");
    expect(policy).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_KERNEL");
    expect(policy).toContain("isTransportKernelAuthority");
  });

  it("snapshot port resolves runtime phase from transport-engine evidence", () => {
    const port = read("app/features/transport-kernel/transport-kernel-snapshot-port.ts");
    expect(port).toContain("resolveRelayRuntimePhaseForTransportKernel");
    expect(port).toContain("readTransportEvidencePhase");
    expect(port).toContain("isTransportKernelSnapshotOwner");
  });

  it("relay runtime supervisor delegates phase to transport-kernel snapshot port", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("resolveRelayRuntimePhaseForTransportKernel");
    expect(supervisor).toContain("buildSupervisorTransportEvidence");
    expect(supervisor).not.toContain("isEngineLabStrictMode");
  });

  it("relay provider gates transport-engine persistence wiring on transport-kernel authority", () => {
    const provider = read("app/features/relays/providers/relay-provider.tsx");
    expect(provider).toContain("isTransportKernelAuthority");
    expect(provider).toMatch(/transportBootstrapReady\s*&&\s*transportKernelAuthority/);
    expect(provider).toContain("useTransportRelayPersistence");
    expect(provider).toContain("useTransportEnginePoolSubscribe");
  });

  it("w5 pool subscribe remains separate from w6 authority flip", () => {
    const subscribe = read("app/features/relays/services/transport-relay-pool-subscribe.ts");
    expect(subscribe).not.toContain("isTransportKernelAuthority");
    expect(subscribe).toContain("addTransientRelay");
  });
});
