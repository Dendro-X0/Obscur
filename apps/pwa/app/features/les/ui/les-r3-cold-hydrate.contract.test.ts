/**
 * R3 contract — cold-hydrate L3 is owned by Rust automated tests (no unlock dogfood).
 * @vitest-environment node
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("LES R3 cold-hydrate gate", () => {
  it("ships an automated Rust cold-hydrate integration test", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const l3 = path.join(repoRoot, "packages/libobscur/tests/les_l3_cold_hydrate.rs");
    expect(existsSync(l3)).toBe(true);
    const source = readFileSync(l3, "utf8");
    expect(source).toContain("l3_cold_hydrate_after_commit_keeps_catalog_and_ciphertext");
    expect(source).toContain("cold list must see committed row");
    expect(source).toContain("read_encrypted_file");
  });

  it("exposes pnpm verify:les-l3 for CI/local gate", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:les-l3");
    expect(pkg).toContain("les_l3_cold_hydrate");
  });
});
