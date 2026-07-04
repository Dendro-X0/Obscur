import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w4 — checkpoint evidence and pool hydration", () => {
  it("bootstrap loads relay checkpoints via transport-engine SDK", () => {
    const bootstrap = read("app/features/relays/services/transport-relay-supervisor-bootstrap.ts");
    expect(bootstrap).toContain("listRelayCheckpoints");
    expect(bootstrap).toContain("loadTransportRelayPersistence");
    expect(bootstrap).toContain("resolveEngineCheckpointRelayUrls");
    expect(bootstrap).not.toMatch(/nostr/i);
  });

  it("relay persistence hook loads URLs and checkpoints together", () => {
    const hook = read("app/features/relays/hooks/use-transport-relay-persistence.ts");
    expect(hook).toContain("loadTransportRelayPersistence");
    expect(hook).toContain("engineCheckpointRelayUrls");
    expect(hook).toContain("relayCheckpoints");
  });

  it("relay provider hydrates pool from engine checkpoint evidence", () => {
    const provider = read("app/features/relays/providers/relay-provider.tsx");
    expect(provider).toContain("useTransportRelayPersistence");
    expect(provider).toContain("resolveEnginePoolHydrationRelayUrls");
    expect(provider).toContain("resolveEffectiveDmTransportRelayUrls");
    expect(provider).toContain("enginePoolHydrationRelayUrls");
    expect(provider).toContain("engineRelayCheckpointCount");
  });

  it("runtime snapshot exposes checkpoint evidence fields", () => {
    const contracts = read("app/features/relays/services/relay-runtime-contracts.ts");
    expect(contracts).toContain("engineCheckpointRelayUrls");
    expect(contracts).toContain("engineRelayCheckpointCount");
  });

  it("pool hydration module stays separate from supervisor evidence builder", () => {
    const hydration = read("app/features/relays/services/transport-relay-pool-hydration.ts");
    const evidence = read("app/features/relays/services/transport-relay-supervisor-evidence.ts");
    expect(hydration).not.toContain("buildTransportSnapshot");
    expect(evidence).not.toContain("resolveEnginePoolHydrationRelayUrls");
  });
});
