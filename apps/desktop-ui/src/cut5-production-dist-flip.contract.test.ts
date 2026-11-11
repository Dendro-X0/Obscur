import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 5.3 — committed frontendDist flip + Next rollback overlay.
 * @see specs/backend/cut5-vite-production-cutover-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readJson = (relativePath: string): Record<string, unknown> => (
  JSON.parse(readFileSync(join(REPO_ROOT, relativePath), "utf8")) as Record<string, unknown>
);

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 5.3 production dist flip", () => {
  it("flips committed tauri.conf.json to desktop-ui dist", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const build = conf.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.beforeBuildCommand).toContain("../desktop-ui");
    expect(build.beforeBuildCommand).not.toContain("build:pwa-shell");
  });

  it("ships Next rollback overlay without deleting apps/pwa", () => {
    const rollback = readJson("apps/desktop/src-tauri/tauri.next.rollback.conf.json");
    const build = rollback.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../pwa/out");
    expect(build.beforeBuildCommand).toContain("build:pwa-shell");

    const pwa = readJson("apps/pwa/package.json");
    expect(pwa.name).toBeTruthy();

    const desktopPkg = readJson("apps/desktop/package.json");
    const scripts = desktopPkg.scripts as Record<string, string>;
    expect(scripts["build:next"]).toContain("tauri.next.rollback.conf.json");
    expect(scripts["dev:next"]).toContain("tauri.dev.conf.json");
  });

  it("defaults production entry to Vite; Next only via explicit rollback", () => {
    const resolver = readText("scripts/obscur-desktop-production-entry.mjs");
    expect(resolver).toContain('return "vite"');
    expect(resolver).toContain("tauri.next.rollback.conf.json");
    expect(resolver).toContain("COMMITTED_PRODUCTION_FRONTEND_DIST = \"../../desktop-ui/dist\"");
  });

  it("keeps Vite lab overlay for :3350 dev (not deleted)", () => {
    const lab = readJson("apps/desktop/src-tauri/tauri.vite.lab.conf.json");
    const build = lab.build as Readonly<{ frontendDist?: string; devUrl?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.devUrl).toBe("http://127.0.0.1:3350");
  });
});
