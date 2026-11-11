import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 6.1 — desktop Vite committed; mobile/CI keep PWA overlay (no silent wipe).
 * @see specs/backend/cut6-release-ci-vite-align-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readJson = (relativePath: string): Record<string, unknown> => (
  JSON.parse(readFileSync(join(REPO_ROOT, relativePath), "utf8")) as Record<string, unknown>
);

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 6.1 mobile CI Vite align", () => {
  it("keeps committed desktop frontendDist on Vite", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const build = conf.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../desktop-ui/dist");
    expect(build.beforeBuildCommand).toContain("desktop-ui");
  });

  it("ships mobile overlay on PWA out (not Vite dist)", () => {
    const mobile = readJson("apps/desktop/src-tauri/tauri.mobile.conf.json");
    const build = mobile.build as Readonly<{ frontendDist?: string; beforeBuildCommand?: string }>;
    expect(build.frontendDist).toBe("../../pwa/out");
    expect(build.beforeBuildCommand).toContain("build:pwa-shell");
  });

  it("wires android build script to mobile overlay by default", () => {
    const runner = readText("apps/desktop/scripts/run-android-build.mjs");
    expect(runner).toContain("tauri.mobile.conf.json");
    expect(runner).toContain("Cut 6.1");
  });

  it("updates android CI verify to Vite desktop + mobile overlay law", () => {
    const workflow = readText(".github/workflows/build-android.yml");
    expect(workflow).toContain("tauri.mobile.conf.json");
    expect(workflow).toContain("../../desktop-ui/dist");
    expect(workflow).not.toMatch(
      /grep -q 'pnpm run build:pwa-shell' apps\/desktop\/src-tauri\/tauri\.conf\.json/,
    );
  });

  it("documents Cut 6 law (Soft L3 paused · no silent wipe)", () => {
    const spec = readText("specs/backend/cut6-release-ci-vite-align-design-2026-11-10.md");
    expect(spec).toContain("Soft L3");
    expect(spec).toContain("tauri.mobile.conf.json");
    expect(spec).toContain("no silent wipe");
    expect(spec).toContain("Continuity");
  });
});
