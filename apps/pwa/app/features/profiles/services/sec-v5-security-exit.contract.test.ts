import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SEC-V5 security exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("verify:sec-v1.9.5 chains SEC-V1–V4 plus trust and relay bands", () => {
    const pkg = readRepo("package.json");
    expect(pkg).toContain('"verify:sec-v1.9.5"');
    expect(pkg).toContain("verify:sec-v1-v1.9.5");
    expect(pkg).toContain("verify:sec-v2-v1.9.5");
    expect(pkg).toContain("verify:sec-v3-v1.9.5");
    expect(pkg).toContain("verify:sec-v4-v1.9.5");
    expect(pkg).toMatch(/verify:relay-v1\.9\.5/);
    expect(pkg).toMatch(/verify:trust-v1\.9\.5/);
    expect(pkg).toMatch(/sec-v5-security-exit\.contract\.test\.ts/);
  });

  it("security validation checklist defines sign-off and §6 regression gates", () => {
    const checklist = readRepo(
      "docs/archive/program/inactive-2026-06/v1.9.5-security-validation-checklist.md",
    );
    expect(checklist).toContain("## Sign-off");
    expect(checklist).toContain("verify:trust-v1.9.5");
    expect(checklist).toContain("verify:platform-kernels");
    expect(checklist).toContain("V3-1");
    expect(checklist).toContain("V1-1");
  });

  it("issues register tracks v1.9.5 SEC band and verify:sec-v1.9.5", () => {
    const register = readRepo("docs/program/unified-verification-issues-register.md");
    expect(register).toContain("v1.9.5");
    expect(register).toContain("verify:sec-v1.9.5");
  });

  it("scope documents SEC-V5 maintainer sign-off evidence", () => {
    const scope = readRepo("docs/archive/program/inactive-2026-06/v1.9.5-scope.md");
    expect(scope).toContain("SEC-V5");
    expect(scope).toContain("Completed checklist + SHA recorded in register");
  });
});
