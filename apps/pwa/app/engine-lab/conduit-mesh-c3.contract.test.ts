import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const INTEGRATION_SPEC = join(
  REPO_ROOT,
  "docs/program/conduit-mesh-c3-tor-probe-integration.md",
);

describe("conduit-mesh-c3 — tor integration spec", () => {
  it("documents TorStatusSnapshot mapping and fail-closed policy", () => {
    const source = readFileSync(INTEGRATION_SPEC, "utf8");
    expect(source).toMatch(/MeshTorRuntimeState/);
    expect(source).toMatch(/tor_unreachable/);
    expect(source).toMatch(/get_tor_status/);
  });
});
