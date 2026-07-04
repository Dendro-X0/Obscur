import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w5 — pool subscribe wiring", () => {
  it("relay provider wires transport-engine pool subscribe hook", () => {
    const provider = read("app/features/relays/providers/relay-provider.tsx");
    expect(provider).toContain("useTransportEnginePoolSubscribe");
    expect(provider).toContain("engineOnlyRelayUrls");
    expect(provider).toContain("engineCheckpointRelayUrls");
    expect(provider).not.toContain("listConfiguredRelayUrls");
  });

  it("pool subscribe service resolves engine evidence URLs without nostr imports", () => {
    const subscribe = read("app/features/relays/services/transport-relay-pool-subscribe.ts");
    expect(subscribe).toContain("resolveTransportEnginePoolSubscribeUrls");
    expect(subscribe).toContain("syncTransportEnginePoolSubscriptions");
    expect(subscribe).toContain("addTransientRelay");
    expect(subscribe).not.toMatch(/nostr/i);
  });

  it("pool subscribe hook delegates to sync service and logs evidence", () => {
    const hook = read("app/features/relays/hooks/use-transport-engine-pool-subscribe.ts");
    expect(hook).toContain("syncTransportEnginePoolSubscriptions");
    expect(hook).toContain("relay.transport_engine_pool_subscribe");
    expect(hook).not.toMatch(/@\/app\/legacy\//);
  });

  it("w4 pool hydration remains separate from w5 transient subscribe wiring", () => {
    const hydration = read("app/features/relays/services/transport-relay-pool-hydration.ts");
    const subscribe = read("app/features/relays/services/transport-relay-pool-subscribe.ts");
    expect(hydration).not.toContain("addTransientRelay");
    expect(subscribe).not.toContain("resolveEnginePoolHydrationRelayUrls");
  });

  it("supervisor bootstrap loader remains separate from pool subscribe wiring", () => {
    const bootstrap = read("app/features/relays/services/transport-relay-supervisor-bootstrap.ts");
    expect(bootstrap).not.toContain("addTransientRelay");
    expect(bootstrap).toContain("loadTransportRelayPersistence");
  });
});
