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

describe("transport-engine w23 — publish parity harness charter", () => {
  it("pins the parity harness charter and required dimensions", () => {
    const charter = readFromRepo("docs/program/transport-engine-w23-publish-parity-harness-charter.md");
    expect(charter).toContain("Headless Publish Parity Harness Charter");
    expect(charter).toContain("Required parity dimensions");
    expect(charter).toContain("Relay normalization parity");
    expect(charter).toContain("Quorum parity");
    expect(charter).toContain("Result shape parity");
    expect(charter).toContain("Reason/status parity");
  });

  it("pins semantic baseline owners and keeps Rust publish stubbed", () => {
    const mapper = readFromPwa("app/features/relays/lib/publish-outcome-mapper.ts");
    expect(mapper).toContain("mapLegacyPublishResultToRelayPublishResult");
    expect(mapper).toContain("quorum_not_met");

    const standaloneOwner = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(standaloneOwner).toContain("publishTransportKernelToRelayUrls");
    expect(standaloneOwner).toContain("mapLegacyPublishResultToRelayPublishResult");

    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });
});

