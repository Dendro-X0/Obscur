import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

describe("Remaster R2 checklist", () => {
  it("documents E2E soak without Soft L3 / Continuity Pass claims", () => {
    const checklist = readFileSync(
      join(REPO_ROOT, "specs/backend/remaster-r2-e2e-soak-checklist-2026-11-10.md"),
      "utf8",
    );
    expect(checklist).toContain("verify:remaster-r2");
    expect(checklist).toContain("≠ Continuity Pass");
    expect(checklist).toContain("Soft L3");
    expect(checklist).toContain("create → unlock → home → T3 → Continuity");
  });
});
