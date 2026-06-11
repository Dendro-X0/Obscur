import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * v1.9.4 Phase B — programmatic entry gate (no live dev server required).
 */
describe("v1.9.4 Phase B programmatic exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");

  it("verify:phase-b-programmatic script chains platform + community invariants + path-b", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:phase-b-programmatic");
    expect(pkg).toMatch(/verify:phase-b-programmatic[\s\S]*verify:platform-kernels[\s\S]*test:community-invariants[\s\S]*verify:path-b/);
  });

  it("handoff documents Phase B community verification step", () => {
    const handoff = readFileSync(
      path.join(repoRoot, "docs/handoffs/current-session.md"),
      "utf8",
    );
    expect(handoff).toMatch(/Phase B|v1\.9\.4 Phase B/i);
    expect(handoff).toContain("verify:platform-kernels");
    expect(handoff).toMatch(/membership-join-leave|COM-8|COM-3/i);
  });
});
