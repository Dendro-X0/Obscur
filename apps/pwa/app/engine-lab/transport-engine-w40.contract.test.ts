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

describe("transport-engine w40 — Rust network publish wiring charter (design-only)", () => {
  it("pins network wiring charter referencing protocol publish surfaces", () => {
    const charter = readFromRepo("docs/program/transport-engine-w40-rust-network-publish-wiring-charter.md");
    expect(charter).toContain("Rust Network Publish Wiring Charter");
    expect(charter).toContain("publish_with_quorum_attempts");
    expect(charter).toContain("design + contract only");
    expect(charter).toContain("assemble_transport_publish_relay_event_dry_run");
  });

  it("asserts engine_invoke uses protocol network assembly when lab gate enabled", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_network");
    expect(rust).toContain("publish_with_quorum_attempts");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });

  it("keeps standalone publish owner as runtime baseline", () => {
    const owner = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(owner).toContain("publishTransportKernelToRelayUrls");
    expect(owner).toContain("relayNativeAdapter");
  });
});
