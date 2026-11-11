import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 11.5 lab checklist", () => {
  it("documents Vite product-depth soak without Continuity Pass claim", () => {
    const checklist = readText("specs/backend/cut11-lab-milestone-checklist-2026-11-10.md");
    expect(checklist).toContain("≠ Continuity Pass");
    expect(checklist).toContain("Soft L3");
    expect(checklist).toContain("verify:cut11-5");
    expect(checklist).toContain("createVitePassphraseIdentity");
  });
});
