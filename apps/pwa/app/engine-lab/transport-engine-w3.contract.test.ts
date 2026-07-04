import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w3 — supervisor snapshot and recovery evidence", () => {
  it("relay runtime snapshot exposes transport-engine relay evidence fields", () => {
    const contracts = read("app/features/relays/services/relay-runtime-contracts.ts");
    expect(contracts).toContain("engineConfiguredRelayUrls");
    expect(contracts).toContain("supervisorRelayUrlCandidates");
    expect(contracts).toContain("engineOnlyRelayUrls");
  });

  it("relay runtime supervisor builds transport evidence via transport-engine SDK", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("transport-relay-supervisor-evidence");
    expect(supervisor).toContain("buildSupervisorTransportEvidence");
    expect(supervisor).toContain("resolveSupervisorRecoveryRelayEvidence");
    expect(supervisor).toContain("relay.transport_engine_evidence");
    expect(supervisor).not.toContain("listConfiguredRelayUrls");
  });

  it("supervisor evidence module delegates snapshot build to transport-engine", () => {
    const evidence = read("app/features/relays/services/transport-relay-supervisor-evidence.ts");
    expect(evidence).toContain("@obscur/transport-engine");
    expect(evidence).toContain("buildTransportSnapshot");
    expect(evidence).toContain("resolveRelayRuntimePhaseRelayCount");
    expect(evidence).not.toMatch(/nostr/i);
  });

  it("relay provider passes engine and user relay evidence into supervisor configure", () => {
    const provider = read("app/features/relays/providers/relay-provider.tsx");
    expect(provider).toContain("engineConfiguredRelayUrls");
    expect(provider).toContain("userEnabledRelayUrls");
    expect(provider).toContain("mergeSupervisorRelayUrlCandidates");
  });

  it("w2 bootstrap loader remains separate from w3 evidence builder", () => {
    const bootstrap = read("app/features/relays/services/transport-relay-supervisor-bootstrap.ts");
    expect(bootstrap).toContain("listConfiguredRelayUrls");
    expect(bootstrap).not.toContain("buildTransportSnapshot");
  });
});
