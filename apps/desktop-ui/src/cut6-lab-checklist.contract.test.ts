import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 6.4 — lab checklist + soak exist; Soft L3 not claimed.
 * @see specs/backend/cut6-lab-milestone-checklist-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 6.4 lab milestone checklist", () => {
  it("documents desktop Vite + mobile PWA overlay soak", () => {
    const checklist = readText("specs/backend/cut6-lab-milestone-checklist-2026-11-10.md");
    expect(checklist).toContain("tauri.mobile.conf.json");
    expect(checklist).toContain("desktop-ui/dist");
    expect(checklist).toContain("≠ Soft L3 Fixed");
    expect(checklist).toContain("cut6-lab-release-ci-soak.mjs");
    expect(checklist).toContain("Continuity Pass");
  });

  it("ships headless soak script", () => {
    const soak = readText("scripts/cut6-lab-release-ci-soak.mjs");
    expect(soak).toContain("≠ Soft L3");
    expect(soak).toContain("tauri.mobile.conf.json");
    expect(soak).toContain("cut6-channel-download-face.contract.test.ts");
  });
});
