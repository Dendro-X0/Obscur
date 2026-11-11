import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 5.2 recipes — production runner + rollback scripts (superseded default by 5.3 flip).
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

describe("Cut 5.2 / 5.3 production recipes", () => {
  it("routes desktop dev/build through production resolver (not hard-coded Next)", () => {
    const desktopPkg = readJson("apps/desktop/package.json");
    const scripts = desktopPkg.scripts as Record<string, string>;
    expect(scripts.dev).toContain("run-desktop-production.mjs");
    expect(scripts.build).toContain("run-desktop-production.mjs");
    expect(scripts.dev).not.toContain("tauri.vite.lab.conf.json");
    expect(scripts.build).not.toContain("tauri.vite.lab.conf.json");
    expect(scripts["dev:next"]).toContain("tauri.dev.conf.json");
    expect(scripts["build:next"]).toContain("tauri.next.rollback.conf.json");
  });

  it("keeps committed production frontendDist on Vite after 5.3", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const build = conf.build as Readonly<{ frontendDist?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
  });

  it("production runner documents Vite default + Next rollback (no silent wipe)", () => {
    const runner = readText("scripts/run-desktop-production.mjs");
    expect(runner).toContain("OBSCUR_DESKTOP_PRODUCTION_ENTRY");
    expect(runner).toContain("resolveDesktopProductionTauriArgs");
    expect(runner).toContain("Cut 5.3");
    expect(runner).toContain("no silent wipe");
  });

  it("resolver uses committed Vite build + Next rollback overlay", () => {
    const resolver = readText("scripts/obscur-desktop-production-entry.mjs");
    expect(resolver).toContain("resolveDesktopProductionTauriArgs");
    expect(resolver).toContain("tauri.vite.lab.conf.json");
    expect(resolver).toContain("tauri.dev.conf.json");
    expect(resolver).toContain("tauri.next.rollback.conf.json");
    expect(resolver).toContain("buildTauriConfig: null");
  });
});
