import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Workspace kernel complete — W0–W4 chain is the platform community delivery gate.
 */
describe("workspace-kernel complete exit contract", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");

  it("verify:workspace-kernel chains W0 through W4", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain('"verify:workspace-kernel": "pnpm verify:workspace-kernel-w4"');
    expect(pkg).toContain("verify:workspace-kernel-w0");
    expect(pkg).toContain("verify:workspace-kernel-w4");
  });

  it("verify:platform-kernels chains dm-kernel and workspace-kernel", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:platform-kernels");
    expect(pkg).toMatch(/verify:platform-kernels[\s\S]*verify:v2-slim[\s\S]*verify:workspace-kernel/);
  });

  it("manifest marks W0–W4 complete", () => {
    const manifest = readFileSync(
      path.join(repoRoot, "docs/program/workspace-kernel-manifest.md"),
      "utf8",
    );
    expect(manifest).toMatch(/W4.*Landed/i);
    expect(manifest).toMatch(/W0–W4 complete|W1–W4.*Complete/i);
  });
});
