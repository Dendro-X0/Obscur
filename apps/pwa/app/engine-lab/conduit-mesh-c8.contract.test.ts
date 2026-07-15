import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c8 — mesh HTTP gateway", () => {
  it("charter documents C8 scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c8-mesh-http-gateway-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C8 — private mesh HTTP gateway/);
    expect(charter).toMatch(/CUSTOM_CONDUIT_HTTP_V1/);
  });

  it("relay-gateway starts mesh HTTP listener", () => {
    const index = readFileSync(
      join(REPO_ROOT, "apps/relay-gateway/src/index.ts"),
      "utf8",
    );
    expect(index).toMatch(/startMeshHttpGatewayServer/);
    expect(index).toMatch(/MESH_HTTP_PORT/);
  });

  it("http relay URLs map to team_relay dialect", () => {
    const resolver = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/resolve-relay-pool-conduit-descriptors.ts"),
      "utf8",
    );
    expect(resolver).toMatch(/team_relay/);
  });
});
