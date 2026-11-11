import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 8.1 — Continuity M1 seal contracts. ≠ Continuity Pass · ≠ Soft L3.
 * @see specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 8.1 Continuity M1 seal", () => {
  it("names vite-native seal without apps/pwa import", () => {
    const seal = readText("apps/desktop-ui/src/continuity/vite-continuity-m1-seal.ts");
    const snapshot = readText("apps/desktop-ui/src/continuity/continuity-m1-snapshot.ts");
    expect(seal).toContain("deriveAesGcmKey");
    expect(seal).toContain("sealContinuityM1Snapshot");
    expect(seal).not.toMatch(/from ["']@\/app\//);
    expect(seal).not.toMatch(/from ["'][^"']*apps\/pwa/);
    expect(snapshot).toContain("obscur.continuity_m1.v1");
    expect(snapshot).toContain("obscur.continuity_m1.sealed.v1");
  });

  it("keeps Cut 8 design ≠ Continuity Pass", () => {
    const spec = readText("specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toContain("No apps/pwa");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
  });
});
