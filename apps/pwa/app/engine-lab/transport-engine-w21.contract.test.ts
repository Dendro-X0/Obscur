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

describe("transport-engine w21 — typed host adapter for publishRelayEvent", () => {
  it("adds a typed host adapter that parses the publish result contract", () => {
    const port = readFromPwa("app/features/transport-kernel/transport-engine-host-port.ts");
    expect(port).toContain("publishRelayEventViaTransportEngineHost");
    expect(port).toContain("isTransportPublishRelayEventResult");
    expect(port).toContain("transport_publish_invalid_result");
  });

  it("pins that w21 remains non-wired at runtime", () => {
    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("transport_publish_not_wired");
  });
});

