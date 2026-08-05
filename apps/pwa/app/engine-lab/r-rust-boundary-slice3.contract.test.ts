import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R-RUST-BOUNDARY — inventory guards (no handler deletion).
 * @see specs/backend/r-rust-boundary-slice3-design-2026-07.md
 */

const REPO_ROOT = join(__dirname, "../../../../");

const readRepo = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("R-RUST-BOUNDARY Slice 3 — engine invoke guards", () => {
  it("desktop generate_handler registers commands::engine::engine_invoke", () => {
    const source = readRepo("apps/desktop/src-tauri/src/lib.rs");
    expect(source).toContain("commands::engine::engine_invoke");
  });

  it("engine.rs is a thin boundary to libobscur::engine_invoke::dispatch", () => {
    const source = readRepo("apps/desktop/src-tauri/src/commands/engine.rs");
    expect(source).toContain("libobscur::engine_invoke::{dispatch");
    expect(source).toMatch(/dispatch\s*\(\s*db\s*,\s*&request\s*\)/);
    expect(source).not.toMatch(/fn\s+dispatch\s*\(/);
  });

  it("libobscur dispatch rejects auth engine (auth_boot_snapshot owner)", () => {
    const source = readRepo("packages/libobscur/src/engine_invoke.rs");
    expect(source).toContain("\"auth\"");
    expect(source).toContain("auth_boot_snapshot");
    expect(source).toMatch(/"auth"\s*=>\s*err\(/);
  });
});
