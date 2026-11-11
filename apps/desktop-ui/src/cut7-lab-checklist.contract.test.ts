import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 7.5 — lab checklist + soak; Continuity Pass / Soft L3 not claimed.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 7.5 lab milestone checklist", () => {
  it("documents Continuity M1 soak without Continuity Pass claim", () => {
    const checklist = readText("specs/backend/cut7-lab-milestone-checklist-2026-11-10.md");
    expect(checklist).toContain("≠ Continuity Pass");
    expect(checklist).toContain("≠ Soft L3 Fixed");
    expect(checklist).toContain("cut7-lab-continuity-m1-soak.mjs");
    expect(checklist).toContain("Unlock ≠ Continuity");
  });

  it("ships headless soak script", () => {
    const soak = readText("scripts/cut7-lab-continuity-m1-soak.mjs");
    expect(soak).toContain("≠ Continuity Pass");
    expect(soak).toContain("cut7-continuity-door.contract.test.ts");
    expect(soak).toContain("CHAT_STATE_AS_SOLE_CRM_REFUSED");
  });
});
