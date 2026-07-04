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

  it("relay standalone publish port uses transport-kernel owner for native path", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
    expect(port).toContain("publishTransportKernelToRelay");
    expect(port).toContain("publishTransportKernelToRelayUrls");
  });

  it("native standalone publish no longer delegates to legacy runtime on authority path", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("shouldUseLegacyStandaloneRelayPublish");
    expect(port).toContain("publishLegacyToUrlsStandalone");
    expect(port).toContain("publishLegacyToRelayStandalone");
    expect(port).not.toMatch(/return await publishLegacyToUrlsStandalone\(normalized, payload\)/);
    expect(port).not.toMatch(/return await publishLegacyToRelayStandalone\(normalized, payload\)/);
  });
});

