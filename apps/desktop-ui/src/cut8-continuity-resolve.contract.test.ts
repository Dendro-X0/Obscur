import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 8.3 / 8.4 — Continuity prefer-native resolve + App wire. ≠ Continuity Pass.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 8.3 Continuity resolve", () => {
  it("ships resolveDesktopUiContinuityPorts prefer-native", () => {
    const resolve = readText("apps/desktop-ui/src/continuity/resolve-continuity-ports.ts");
    expect(resolve).toContain("resolveDesktopUiContinuityPorts");
    expect(resolve).toContain("resolveDesktopUiAdapterSource");
  });
});

describe("Cut 8.4 Continuity App wire", () => {
  it("wires prefer-native Continuity ports into App", () => {
    const app = readText("apps/desktop-ui/src/App.tsx");
    expect(app).toContain("createViteContinuityPorts");
    expect(app).toContain("resolveDesktopUiContinuityPorts");
    expect(app).toContain("createLabContinuityPorts");
    expect(app).toContain("Continuity Pass not claimed");
  });

  it("ContinuityDoor collects Continuity passphrase + file import", () => {
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(door).toContain("continuity-passphrase");
    expect(door).toContain("continuity-import-file");
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
