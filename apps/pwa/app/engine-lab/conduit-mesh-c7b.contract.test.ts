import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c7b — default-on mesh pool policy", () => {
  it("charter documents C7b default-on and opt-out", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c7-client-integration-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C7b/);
    expect(charter).toMatch(/default-on/);
    expect(charter).toMatch(/CONDUIT_MESH_POOL=0/);
  });

  it("pool hook policy defaults mesh on under transport-kernel ownership", () => {
    const policy = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/conduit-mesh-pool-hook-port.ts"),
      "utf8",
    );
    expect(policy).toMatch(/isConduitMeshPoolExplicitlyDisabled/);
    expect(policy).not.toMatch(/CONDUIT_MESH_POOL === "1"/);
  });

  it("tri-route prefers mesh before transport-kernel enhanced pool", () => {
    const hookPort = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts"),
      "utf8",
    );
    expect(hookPort).toMatch(/if \(useConduitMesh\) return meshPool/);
    expect(hookPort).toMatch(/shouldUseConduitMeshRelayPoolHook/);
  });
});
