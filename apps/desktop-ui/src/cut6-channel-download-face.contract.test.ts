import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 6.3 — channel / download-face names Vite desktop default.
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

describe("Cut 6.3 channel / download face", () => {
  it("stable channel README states Vite desktop default + Next rollback", () => {
    const readme = readText("apps/desktop/release/channel/stable/README.md");
    expect(readme).toContain("Vite");
    expect(readme).toContain("apps/desktop-ui/dist");
    expect(readme).toContain("rollback");
    expect(readme).toContain("apps/pwa");
  });

  it("updater feed path still points at stable latest.json", () => {
    const conf = readJson("apps/desktop/src-tauri/tauri.conf.json");
    const plugins = conf.plugins as Readonly<{
      updater?: Readonly<{ endpoints?: ReadonlyArray<string> }>;
    }>;
    const endpoints = plugins.updater?.endpoints ?? [];
    expect(endpoints.some((url) => url.includes("release/channel/stable/latest.json"))).toBe(true);
  });

  it("Cut 6 design names channel slice + Soft L3 paused", () => {
    const spec = readText("specs/backend/cut6-release-ci-vite-align-design-2026-11-10.md");
    expect(spec).toContain("6.3");
    expect(spec).toContain("download-face");
    expect(spec).toContain("Soft L3");
  });
});
