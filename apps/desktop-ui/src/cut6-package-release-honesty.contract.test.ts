import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 6.2 — package/release copy names Vite desktop default (Next = rollback).
 * @see specs/backend/cut6-release-ci-vite-align-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 6.2 package/release honesty", () => {
  it("desktop:package labels Vite bundle (not PWA-as-default)", () => {
    const packager = readText("scripts/package-desktop-local.mjs");
    expect(packager).toContain("build Vite desktop-ui + Tauri bundle");
    expect(packager).toContain("build:desktop");
    expect(packager).not.toContain("build PWA shell + Tauri bundle");
  });

  it("stable channel README names Vite desktop + Next rollback", () => {
    const readme = readText("apps/desktop/release/channel/stable/README.md");
    expect(readme).toContain("Vite");
    expect(readme).toContain("desktop-ui");
    expect(readme).toContain("rollback");
    expect(readme).toContain("Soft L3");
  });

  it("release android path keeps mobile overlay after Cut 6.1", () => {
    const release = readText(".github/workflows/release.yml");
    expect(release).toContain("tauri.mobile.conf.json");
  });
});
