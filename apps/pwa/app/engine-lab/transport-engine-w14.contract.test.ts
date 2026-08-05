import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w14 — dedicated native standalone publish owner", () => {
  it("transport-kernel standalone publish owner encapsulates native relay publish", () => {
    const owner = read(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(owner).toContain("publishTransportKernelToRelay");
    expect(owner).toContain("publishTransportKernelToRelayUrls");
    expect(owner).toContain("relayNativeAdapter");
    expect(owner).toContain("quorumRequired");
  });

  it("relay standalone publish port is thin subtracted re-export after W66", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).not.toContain("transport-kernel-standalone-publish-legacy");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
    expect(port).toContain("publishToRelayStandaloneSubtracted as publishToRelayStandalone");
    expect(port).toContain("publishToUrlsStandaloneSubtracted as publishToUrlsStandalone");
  });

  it("native standalone publish no longer embeds legacy runtime in production port", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).not.toContain("shouldUseLegacyStandaloneRelayPublish");
    expect(port).not.toContain("publishLegacyToUrlsStandalone");
    expect(port).not.toContain("publishLegacyToRelayStandalone");
  });
});

