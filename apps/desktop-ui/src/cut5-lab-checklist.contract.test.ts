import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 5.4 — lab checklist + soak exist; Soft L3 / Continuity not claimed.
 * @see specs/backend/cut5-lab-milestone-checklist-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 5.4 lab milestone checklist", () => {
  it("documents Vite-as-default L2 soak + Next rollback + Soft L3 paused", () => {
    const checklist = readText("specs/backend/cut5-lab-milestone-checklist-2026-11-10.md");
    expect(checklist).toContain("Vite as the default desktop webview");
    expect(checklist).toContain("OBSCUR_DESKTOP_PRODUCTION_ENTRY=next");
    expect(checklist).toContain("tauri.next.rollback.conf.json");
    expect(checklist).toContain("≠ Soft L3 Fixed");
    expect(checklist).toContain("Continuity Pass");
    expect(checklist).toContain("cut5-lab-vite-production-soak.mjs");
    expect(checklist).not.toMatch(/Soft L3 Fixed\s*$/m);
  });

  it("ships headless soak script that refuses Soft L3 claim", () => {
    const soak = readText("scripts/cut5-lab-vite-production-soak.mjs");
    expect(soak).toContain("≠ Soft L3");
    expect(soak).toContain("obscur-desktop-production-entry.selftest.mjs");
    expect(soak).toContain("cut5-production-dist-flip.contract.test.ts");
    expect(soak).toContain("../../desktop-ui/dist");
  });
});
