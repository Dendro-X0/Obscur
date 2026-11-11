import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Official Beta OB4 product chrome", () => {
  it("hides Matrix lab chip from product protocol chrome", () => {
    const home = readText("apps/desktop-ui/src/private-trust/PrivateTrustHome.tsx");
    expect(home).not.toContain("Matrix (lab)");
    expect(home).toContain('id: "private_dc"');
    expect(home).toContain('id: "nostr"');
    expect(home).toContain('if (next === "matrix")');
    expect(home).toContain("ProductDoors");
  });

  it("exposes Settings / Private home / Continuity as product doors", () => {
    const doors = readText("apps/desktop-ui/src/product/ProductDoors.tsx");
    expect(doors).toContain('data-testid="product-doors"');
    expect(doors).toContain("product-door-tab-${door.id}");
    expect(doors).toContain('id: "settings"');
    expect(doors).toContain('id: "home"');
    expect(doors).toContain('id: "continuity"');
    expect(doors).toContain("≠ Continuity Pass");

    const settings = readText("apps/desktop-ui/src/settings/SettingsDoor.tsx");
    expect(settings).toContain("product-door");
    expect(settings).toContain("@dweb/ui-kit/button");
    expect(settings).toContain("@dweb/ui-kit/input");

    const continuity = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(continuity).toContain("product-door");
    expect(continuity).toContain("≠ Continuity Pass");
  });

  it("keeps product title Obscur without lab wording", () => {
    const html = readText("apps/desktop-ui/index.html");
    expect(html).toContain("<title>Obscur</title>");
    expect(html).not.toMatch(/desktop-ui lab/i);
  });

  it("documents OB4 closeout + CDP spot without Soft L3 / Continuity Pass claims", () => {
    const closeout = readText(
      "specs/backend/official-beta-ob4-product-chrome-2026-11-11.md",
    );
    expect(closeout).toContain("CLOSED");
    expect(closeout).toContain("ProductDoors");
    expect(closeout).toContain("Matrix");
    expect(closeout).toContain("CDP");
    expect(closeout).toContain("≠ Continuity Pass");
    expect(closeout).toContain("Soft L3 Fixed");
    expect(closeout).not.toMatch(/Soft L3 Fixed\s*\*\*Pass\*\*/);
    expect(closeout).not.toMatch(/Continuity Pass\s*\*\*claimed\*\*/);
    expect(closeout).toContain("OB5");
  });
});
