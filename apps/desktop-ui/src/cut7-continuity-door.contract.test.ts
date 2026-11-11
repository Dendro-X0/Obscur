import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 7.4 — Vite Continuity door wired; Next Settings may remain; ≠ Continuity Pass.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 7.4 Continuity door", () => {
  it("wires ContinuityDoor + Continuity ports into App shell", () => {
    const app = readText("apps/desktop-ui/src/App.tsx");
    expect(app).toContain("createLabContinuityPorts");
    expect(app).toMatch(/continuityPorts|resolvedContinuity/);
    expect(app).toContain("Continuity Pass not claimed");
  });

  it("ships ContinuityDoor with honesty status", () => {
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(door).toContain("continuity-honesty");
    expect(door).toContain("empty | restoring | partial | full");
    expect(door).toContain("unlock does not restore");
  });

  it("keeps Next portable backup owners (no silent wipe)", () => {
    const unified = readText(
      "apps/pwa/app/features/profiles/services/unified-account-export-service.ts",
    );
    expect(unified).toContain("exportUnifiedAccountBundle");
    expect(unified).toContain("importUnifiedAccountBundle");
  });
});
