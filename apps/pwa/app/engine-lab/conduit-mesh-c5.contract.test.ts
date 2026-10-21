import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c5 — pool retirement wiring", () => {
  it("relay pool hook port is mesh-only (RUST-4c legacy orchestrator removed)", () => {
    const hookPort = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts"),
      "utf8",
    );
    expect(hookPort).toMatch(/useConduitMeshRelayPool/);
    expect(hookPort).toMatch(/RUST-4c/);
    expect(hookPort).not.toMatch(/enhanced-relay-pool-legacy/);
    expect(hookPort).not.toMatch(/shouldUseConduitMeshRelayPoolHook/);
  });

  it("pool hook policy supports opt-out via CONDUIT_MESH_POOL env", () => {
    const policy = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/conduit-mesh-pool-hook-port.ts"),
      "utf8",
    );
    expect(policy).toMatch(/NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL/);
    expect(policy).toMatch(/isConduitMeshPoolExplicitlyDisabled/);
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
