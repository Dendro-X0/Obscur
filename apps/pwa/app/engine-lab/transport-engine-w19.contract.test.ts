import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w19 — host publish parity verification charter", () => {
  it("pins charter for parity verification before wiring", () => {
    const charter = readFromRepo("docs/program/transport-engine-w19-host-publish-parity-charter.md");
    expect(charter).toContain("Parity definition");
    expect(charter).toContain("Non-goals / forbidden drift");
    expect(charter).toContain("Do **not** add a Rust implementation that actually sends relay messages.");
    expect(charter).toContain("transport_publish_not_wired");
  });

  it("pins shared publish-outcome mapper as semantic owner", () => {
    const charter = readFromRepo("docs/program/transport-engine-w19-host-publish-parity-charter.md");
    expect(charter).toContain("publish-outcome-mapper.ts");
    expect(charter).toContain("mapLegacyPublishResultToRelayPublishResult");

    const mapper = readFromPwa("app/features/relays/lib/publish-outcome-mapper.ts");
    expect(mapper).toContain("mapLegacyPublishResultToRelayPublishResult");
    expect(mapper).toContain("quorum_not_met");
    expect(mapper).toContain("relay_degraded");
  });

  it("pins canonical runtime owner as transport-kernel standalone publish", () => {
    const charter = readFromRepo("docs/program/transport-engine-w19-host-publish-parity-charter.md");
    expect(charter).toContain("transport-kernel-standalone-publish.ts");
    expect(charter).toContain("relay-standalone-publish-port.ts");

    const owner = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(owner).toContain("publishTransportKernelToRelayUrls");
    expect(owner).toContain("mapLegacyPublishResultToRelayPublishResult");

    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelayUrls");
    expect(port).toContain("shouldUseLegacyStandaloneRelayPublish");
  });

  it("pins libobscur publishRelayEvent as explicit not-wired stub", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
    expect(rust).toContain("unknown transport method");
  });
});

