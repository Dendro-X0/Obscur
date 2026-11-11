import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 8.5 — lab checklist present · ≠ Continuity Pass.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 8.5 lab checklist", () => {
  it("documents native M1 soak without Continuity Pass claim", () => {
    const checklist = readText("specs/backend/cut8-lab-milestone-checklist-2026-11-10.md");
    expect(checklist).toContain("≠ Continuity Pass");
    expect(checklist).toContain("Soft L3");
    expect(checklist).toContain("verify:cut8-5");
    expect(checklist).toContain("createViteContinuityPorts");
  });
});
