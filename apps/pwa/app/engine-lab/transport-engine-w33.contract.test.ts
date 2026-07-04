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

describe("transport-engine w33 — host publish port shim charter", () => {
  it("pins opt-in shim charter and policy gate expectations", () => {
    const charter = readFromRepo("docs/program/transport-engine-w33-host-publish-port-shim-charter.md");
    expect(charter).toContain("Host Publish Port Shim Charter");
    expect(charter).toContain("shouldUseHostTransportPublishShim");
    expect(charter).toContain("design + contract only");
  });

  it("keeps default routing on transport-kernel standalone owner", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelayUrls");
    expect(port).not.toMatch(/shouldUseHostTransportPublishShim\(\)[\s\S]*publishRelayEventViaTransportEngineHost/);
  });

  it("keeps Rust publish stubbed for valid invokes", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });
});
