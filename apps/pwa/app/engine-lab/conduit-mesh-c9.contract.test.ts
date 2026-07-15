import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c9 — tor host integration", () => {
  it("charter documents C9 scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c9-tor-host-integration-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C9 — Tor host integration/);
    expect(charter).toMatch(/get_tor_status/);
  });

  it("mesh relay pool hook wires getTorState from tor host port", () => {
    const hook = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts"),
      "utf8",
    );
    expect(hook).toMatch(/createConduitMeshTorHostPort/);
    expect(hook).toMatch(/getTorState/);
    expect(hook).toMatch(/subscribeConduitMeshTorHostRefresh/);
  });

  it("tor host port maps TorStatusSnapshot via mesh mapper", () => {
    const port = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/conduit-mesh-tor-host-port.ts"),
      "utf8",
    );
    expect(port).toMatch(/mapTorStatusSnapshotToMeshTorState/);
    expect(port).toMatch(/tor-status/);
  });
});
