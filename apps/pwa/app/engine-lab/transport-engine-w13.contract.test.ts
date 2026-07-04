import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w13 — journal-backed standalone publish", () => {
  it("relay standalone publish port journals native standalone publish", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("relayTransportJournal");
    expect(port).toContain("setPendingOutbound");
    expect(port).toContain("clearPendingOutbound");
    expect(port).toContain("publishLegacyToUrlsStandalone");
    expect(port).toContain("publishLegacyToRelayStandalone");
  });

  it("native standalone publish no longer calls relayNativeAdapter directly", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).not.toContain("relayNativeAdapter");
    expect(port).toContain("shouldUseLegacyStandaloneRelayPublish");
  });

  it("enhanced relay pool port still surfaces canonical standalone publish facade", () => {
    const poolPort = read("app/features/relays/hooks/enhanced-relay-pool-port.ts");
    expect(poolPort).toContain("relay-standalone-publish-port");
    expect(poolPort).toContain("publishToUrlsStandalone");
  });
});

