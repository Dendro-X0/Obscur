import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w2 — supervisor bootstrap wiring", () => {
  it("relay provider loads transport-engine configured relay URLs on boot", () => {
    const provider = read("app/features/relays/providers/relay-provider.tsx");
    expect(provider).toContain("useTransportRelayPersistence");
    expect(provider).toContain("mergeSupervisorRelayUrlCandidates");
    expect(provider).toContain("transport-relay-supervisor-bootstrap");
    expect(provider).not.toContain("listConfiguredRelayUrls");
    expect(provider).not.toMatch(/engine_invoke/);
  });

  it("bootstrap service calls transport-engine SDK via engine host port", () => {
    const bootstrap = read("app/features/relays/services/transport-relay-supervisor-bootstrap.ts");
    expect(bootstrap).toContain("@obscur/transport-engine");
    expect(bootstrap).toContain("listConfiguredRelayUrls");
    expect(bootstrap).toContain("transport-engine-host-port");
    expect(bootstrap).toContain("mergeSupervisorRelayUrlCandidates");
    expect(bootstrap).not.toMatch(/nostr/i);
  });

  it("transport engine host port uses createTauriEngineHost", () => {
    const port = read("app/features/transport-kernel/transport-engine-host-port.ts");
    expect(port).toContain("@obscur/engine-host");
    expect(port).toContain("createTauriEngineHost");
    expect(port).toContain("isTauriEngineHostAvailable");
  });

  it("relay runtime supervisor still routes recovery through relay-recovery-port", () => {
    const supervisor = read("app/features/relays/services/relay-runtime-supervisor.ts");
    expect(supervisor).toContain("relay-recovery-port");
    expect(supervisor).not.toContain("transport-relay-supervisor-bootstrap");
  });

  it("configured relay URL hook delegates to persistence loader", () => {
    const hook = read("app/features/relays/hooks/use-transport-configured-relay-urls.ts");
    expect(hook).toContain("useTransportRelayPersistence");
    expect(hook).toContain("engineConfiguredRelayUrls");
  });
});
