import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c5 — pool retirement wiring", () => {
  it("relay pool hook port tri-routes to conduit mesh", () => {
    const hookPort = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts"),
      "utf8",
    );
    expect(hookPort).toMatch(/shouldUseConduitMeshRelayPoolHook/);
    expect(hookPort).toMatch(/useConduitMeshRelayPool/);
  });

  it("pool hook policy gates on CONDUIT_MESH_POOL env", () => {
    const policy = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/conduit-mesh-pool-hook-port.ts"),
      "utf8",
    );
    expect(policy).toMatch(/NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL/);
  });

  it("mesh pool hook does not import enhanced-relay-pool-legacy", () => {
    const meshHook = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts"),
      "utf8",
    );
    expect(meshHook).not.toMatch(/enhanced-relay-pool-legacy/);
    expect(meshHook).toMatch(/@obscur\/conduit-mesh/);
  });
});
