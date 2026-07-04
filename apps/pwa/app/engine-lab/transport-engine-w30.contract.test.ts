import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w30 — host publish owner migration charter", () => {
  it("pins phased migration charter without immediate authority flip", () => {
    const charter = readFromRepo("docs/program/transport-engine-w30-host-publish-owner-migration-charter.md");
    expect(charter).toContain("Host Publish Owner Migration Charter");
    expect(charter).toContain("Phase A — Evidence complete (W24–W29)");
    expect(charter).toContain("Phase D — Authority flip");
    expect(charter).toContain("design + contract only");
  });

  it("keeps relay-standalone-publish-port on standalone owner by default with gated host shim", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelayUrls");
    expect(port).toContain("shouldRouteHostTransportPublish");
    expect(port).toContain("publishHostTransportShimToRelayUrls");
  });

  it("pins shared mapper and typed host adapter as migration targets", () => {
    const mapper = readFromPwa("app/features/relays/lib/publish-outcome-mapper.ts");
    expect(mapper).toContain("mapLegacyPublishResultToRelayPublishResult");

    const hostPort = readFromPwa("app/features/transport-kernel/transport-engine-host-port.ts");
    expect(hostPort).toContain("publishRelayEventViaTransportEngineHost");
    expect(hostPort).toContain("isTransportPublishRelayEventResult");
  });
});
