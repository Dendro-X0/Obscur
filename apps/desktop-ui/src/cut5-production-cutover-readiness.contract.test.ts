import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 5.1 → 5.3 readiness: no silent beta wipe; Next rollback path remains;
 * committed production frontendDist is Vite after 5.3.
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

describe("Cut 5 production cutover readiness", () => {
  it("commits production frontendDist to Vite (5.3 landed)", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const build = conf.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.beforeBuildCommand).toContain("desktop-ui");
  });

  it("does not delete Next product shell package", () => {
    const pwa = readJson("apps/pwa/package.json");
    expect(pwa.name).toBeTruthy();
    const desktopPkg = readJson("apps/desktop/package.json");
    const scripts = desktopPkg.scripts as Record<string, string>;
    expect(scripts.build).not.toMatch(/rm\s+-rf.*pwa|Remove-Item.*pwa/i);
  });

  it("ships production entry resolver with rollback env + Vite default", () => {
    const resolver = readText("scripts/obscur-desktop-production-entry.mjs");
    expect(resolver).toContain("OBSCUR_DESKTOP_UI_AS_DEFAULT");
    expect(resolver).toContain("OBSCUR_DESKTOP_PRODUCTION_ENTRY");
    expect(resolver).toContain("../../desktop-ui/dist");
    expect(resolver).toContain("../../pwa/out");
    expect(resolver).toContain("tauri.next.rollback.conf.json");
    expect(resolver).toContain("Cut 5.3");
  });

  it("documents Cut 5 cutover law (no silent wipe · Soft L3 paused)", () => {
    const spec = readText("specs/backend/cut5-vite-production-cutover-design-2026-11-10.md");
    expect(spec).toContain("no silent beta wipe");
    expect(spec).toContain("Soft L3");
    expect(spec).toContain("Continuity");
    expect(spec).toContain("OBSCUR_DESKTOP_UI_AS_DEFAULT");
    expect(spec).toContain("5.1");
  });
});
