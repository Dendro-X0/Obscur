import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 14 Vite Settings NARROW", () => {
  it("ships settings residue storage", () => {
    const residue = readText("apps/desktop-ui/src/settings/vite-settings-residue.ts");
    expect(residue).toContain("obscur.vite.settings.v1");
    expect(residue).toContain("writeViteSettingsResidue");
    expect(residue).toContain("upsertViteSettingsRelay");
  });

  it("wires T2 residue into Continuity M1 + SettingsDoor on home", () => {
    const vite = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    const door = readText("apps/desktop-ui/src/settings/SettingsDoor.tsx");
    const home = readText("apps/desktop-ui/src/private-trust/PrivateTrustHome.tsx");
    expect(vite).toContain("readViteSettingsResidue");
    expect(vite).toContain("writeViteSettingsResidue");
    expect(door).toContain("settings-door");
    expect(door).toContain("≠ live mesh");
    expect(home).toContain("SettingsDoor");
  });

  it("keeps Cut 14 design ≠ Continuity Pass and Soft L3 paused", () => {
    const spec = readText("specs/backend/cut14-vite-settings-narrow-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("apps/pwa Settings mega-import");
    expect(spec).toContain("peer history grants");
  });
});
