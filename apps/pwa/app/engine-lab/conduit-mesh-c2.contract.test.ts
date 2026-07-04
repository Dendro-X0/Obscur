import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PACKAGE_ROOT = join(REPO_ROOT, "packages/obscur-conduit-mesh");

describe("conduit-mesh-c2 — package boundary", () => {
  it("does not import apps/pwa or @dweb/nostr", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    const meshSource = readFileSync(join(PACKAGE_ROOT, "src/create-conduit-mesh.ts"), "utf8");
    expect(indexSource).not.toMatch(/apps\/pwa/);
    expect(meshSource).not.toMatch(/@dweb\/nostr/);
  });

  it("exports createConduitMesh runtime", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    expect(indexSource).toMatch(/createConduitMesh/);
  });
});
