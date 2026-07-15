import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

describe("conduit-mesh-c11 — mesh-native DM wire codec", () => {
  it("charter documents C11 scope", () => {
    const charter = readFileSync(
      join(REPO_ROOT, "docs/program/conduit-mesh-c11-mesh-native-dm-codec-charter.md"),
      "utf8",
    );
    expect(charter).toMatch(/C11 — mesh-native DM wire codec/);
    expect(charter).toMatch(/obscur_mesh_dm_wire_v1/);
  });

  it("design spec defines wire contract and runtime owners", () => {
    const design = readFileSync(
      join(REPO_ROOT, "specs/backend/conduit-mesh-c11-mesh-native-dm-codec-design.md"),
      "utf8",
    );
    expect(design).toMatch(/obscur_mesh_dm_wire_v1/);
    expect(design).toMatch(/conduit-mesh-relay-pool-runtime/);
  });

  it("contracts export mesh-native codec helpers", () => {
    const index = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh-contracts/src/index.ts"),
      "utf8",
    );
    expect(index).toMatch(/isMeshNativeDmWirePayload/);
    expect(index).toMatch(/nostrEventWireToMeshNativeDmWire/);
    expect(index).toMatch(/meshNativeDmWireToNostrEventWire/);
  });

  it("relay pool runtime converts native wire on HTTP publish and inbound bridge", () => {
    const runtime = readFileSync(
      join(REPO_ROOT, "packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.ts"),
      "utf8",
    );
    expect(runtime).toMatch(/resolveHttpMeshCiphertextPayload/);
    expect(runtime).toMatch(/resolveInboundNostrWire/);
    expect(runtime).toMatch(/isMeshNativeDmWirePayload/);
  });
});
