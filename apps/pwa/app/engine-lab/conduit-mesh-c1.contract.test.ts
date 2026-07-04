import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PACKAGE_ROOT = join(REPO_ROOT, "packages/obscur-conduit-mesh-contracts");

describe("conduit-mesh-c1 — package boundary", () => {
  it("does not import apps/pwa or @dweb/nostr", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    expect(indexSource).not.toMatch(/apps\/pwa/);
    expect(indexSource).not.toMatch(/@dweb\/nostr/);
  });

  it("exports MeshPort and custom conduit contract", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    expect(indexSource).toMatch(/MeshPort/);
    expect(indexSource).toMatch(/CUSTOM_CONDUIT_HTTP_V1/);
  });
});
