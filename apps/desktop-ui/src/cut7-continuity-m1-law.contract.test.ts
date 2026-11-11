import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 7.1 — Continuity M1 law (F-sync C0). ≠ Continuity Pass · ≠ Soft L3 Fixed.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 7.1 Continuity M1 law", () => {
  it("names unlock ≠ Continuity and rejects M8/M9 as core sync", () => {
    const spec = readText("specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md");
    expect(spec).toContain("Unlock opens this device only");
    expect(spec).toContain("M8/M9 reject-for-core");
    expect(spec).toContain("K-UNLOCK-EQ-CONT");
    expect(spec).toContain("K-M9-LOOKBACK");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toContain("Soft L3");
  });

  it("requires T0–T2 in C0 M1 with honest T3 partial", () => {
    const spec = readText("specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md");
    expect(spec).toContain("T0–T2 must be representable");
    expect(spec).toContain("T3 may be partial");
    expect(spec).toContain("empty | restoring | partial | full");
  });

  it("keeps F-sync C0 as M1 file round-trip (not live multi-device)", () => {
    const fsync = readText("docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md");
    expect(fsync).toContain("**C0**");
    expect(fsync).toContain("M1 file");
    expect(fsync).toContain("reject-for-core");
    expect(fsync).toContain("M8");
    expect(fsync).toContain("M9");
  });

  it("does not claim Continuity Pass in Cut 7 design status", () => {
    const spec = readText("specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).not.toMatch(/\*\*Continuity Pass\*\*\s*$/m);
  });

  it("preserves portable backup owners (no silent wipe of apps/pwa sync)", () => {
    const backup = readText(
      "apps/pwa/app/features/account-sync/services/encrypted-account-backup-service.ts",
    );
    const unified = readText(
      "apps/pwa/app/features/profiles/services/unified-account-export-service.ts",
    );
    expect(backup).toContain("exportPortableAccountBundle");
    expect(backup).toContain("importPortableAccountBundle");
    expect(unified).toContain("exportUnifiedAccountBundle");
    expect(unified).toContain("importUnifiedAccountBundle");
  });
});
