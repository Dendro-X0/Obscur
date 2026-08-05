import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w15 — standalone publish semantics subtraction", () => {
  it("transport-kernel standalone publish owner reuses shared publish outcome mapper", () => {
    const owner = read(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(owner).toContain("mapLegacyPublishResultToRelayPublishResult");
    expect(owner).not.toContain("resolveQuorumRequired");
  });

  it("production port is thin subtracted re-export; archive retains kernel owner symbols", () => {
    const port = read("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
    expect(port).not.toContain("publishTransportKernelToRelay");

    const owner = read(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(owner).toContain("publishTransportKernelToRelay");
    expect(owner).toContain("publishTransportKernelToRelayUrls");
  });
  it("transport-engine host methods were still read-only before the w17 contract slice", () => {
    const methods = read("../../packages/obscur-engine-contracts/src/transport-engine-methods.ts");
    expect(methods).toContain("listRelayCheckpoints");
    expect(methods).toContain("listConfiguredRelayUrls");
    expect(methods).toContain("publishRelayEvent");
  });
});

