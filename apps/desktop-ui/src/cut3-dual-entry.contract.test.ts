import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 3.4 dual-entry — superseded production default by Cut 5.3.
 * Lab Vite overlay remains; production is Vite; Next stays as rollback (no silent wipe).
 * @see specs/backend/cut3-dual-entry-quarantine-2026-11-09.md
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

describe("Cut 3.4 dual-entry quarantine (post Cut 5.3)", () => {
  it("keeps production frontendDist on Vite with Next rollback path (no silent beta wipe)", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const build = conf.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.beforeBuildCommand).toContain("desktop-ui");

    const rollback = readJson("apps/desktop/src-tauri/tauri.next.rollback.conf.json");
    const rollbackBuild = rollback.build as Readonly<{ frontendDist?: string }>;
    expect(rollbackBuild.frontendDist).toBe("../../pwa/out");

    const desktopPkg = readJson("apps/desktop/package.json");
    const scripts = desktopPkg.scripts as Record<string, string>;
    expect(scripts.build).not.toContain("tauri.vite.lab.conf.json");
    expect(scripts.build).not.toContain("vite.lab");
    expect(scripts["build:next"]).toContain("tauri.next.rollback.conf.json");
  });

  it("keeps Vite lab overlay for optional lab entry", () => {
    const lab = readJson("apps/desktop/src-tauri/tauri.vite.lab.conf.json");
    const build = lab.build as Readonly<{
      frontendDist?: string;
      devUrl?: string;
      beforeDevCommand?: string;
    }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.devUrl).toBe("http://127.0.0.1:3350");
    expect(build.beforeDevCommand).toContain("desktop-ui");

    const desktopPkg = readJson("apps/desktop/package.json");
    const scripts = desktopPkg.scripts as Record<string, string>;
    expect(scripts["dev:vite-lab"]).toContain("tauri.vite.lab.conf.json");
    expect(scripts["dev:lab"]).toContain("dev-desktop-lab.mjs");
  });

  it("ships lab entry resolver + selftest for flag defaults", () => {
    const resolver = readText("scripts/obscur-desktop-lab-entry.mjs");
    const selftest = readText("scripts/obscur-desktop-lab-entry.selftest.mjs");
    expect(resolver).toContain("OBSCUR_TAURI_LAB_UI");
    expect(resolver).toContain("OBSCUR_DESKTOP_LAB_ENTRY");
    expect(resolver).toContain("tauri.vite.lab.conf.json");
    expect(selftest).toContain("labContext: true");
    expect(selftest).toContain("\"vite\"");
  });

  it("documents dual-entry quarantine in Cut 3.4 spec", () => {
    const spec = readText("specs/backend/cut3-dual-entry-quarantine-2026-11-09.md");
    expect(spec).toContain("no silent beta wipe");
    expect(spec).toContain("OBSCUR_TAURI_LAB_UI");
    expect(spec).toContain("../../pwa/out");
    expect(spec).toContain("tauri.vite.lab.conf.json");
  });
});
