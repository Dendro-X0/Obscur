import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PACKAGE_ROOT = join(REPO_ROOT, "packages/obscur-conduit-mesh");

describe("conduit-mesh-c4 — adapter wiring", () => {
  it("exports production driver factory and coordination paths", () => {
    const indexSource = readFileSync(join(PACKAGE_ROOT, "src/index.ts"), "utf8");
    expect(indexSource).toMatch(/createConduitDriverFromDescriptor/);
    expect(indexSource).toMatch(/createCoordinationHttpConduitDriver/);
    expect(indexSource).toMatch(/createTeamRelayConduitDriver/);
  });

  it("coordination driver targets apps/coordination membership head path", () => {
    const source = readFileSync(
      join(PACKAGE_ROOT, "src/coordination-http-conduit-driver.ts"),
      "utf8",
    );
    expect(source).toMatch(/\/membership\/head/);
    expect(source).toMatch(/coordination_head_seq/);
  });
});
