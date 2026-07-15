import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c13 — Tor SOCKS drivers", () => {
  it("charter documents C13 SOCKS scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c13-tor-socks-drivers-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C13 — Tor SOCKS/);
    expect(charter).toMatch(/proxyUrl/);
  });

  it("design locks routed fetch owner", () => {
    const design = readFileSync(
      join(REPO_ROOT, "specs/backend/conduit-mesh-c13-tor-socks-drivers-design.md"),
      "utf8",
    );
    expect(design).toMatch(/createRoutedConduitMeshFetch/);
    expect(design).toMatch(/mesh_http_fetch_via_socks/);
  });

  it("desktop registers mesh_http_fetch_via_socks", () => {
    const system = readFileSync(
      join(REPO_ROOT, "apps/desktop/src-tauri/src/commands/system.rs"),
      "utf8",
    );
    expect(system).toMatch(/mesh_http_fetch_via_socks/);
    expect(system).toMatch(/socks5h/);
  });

  it("pool hook wires socksFetch host port", () => {
    const hook = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts"),
      "utf8",
    );
    expect(hook).toMatch(/createConduitMeshSocksFetchHostPort/);
    expect(hook).toMatch(/socksFetch/);
  });

  it("onion endpoints map to tor_required", () => {
    const resolver = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/resolve-relay-pool-conduit-descriptors.ts"),
      "utf8",
    );
    expect(resolver).toMatch(/isOnionMeshEndpoint/);
    expect(resolver).toMatch(/tor_required/);
  });
});
