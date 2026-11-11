import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Official Beta OB1 visual inventory", () => {
  it("locks keep ui-kit · adapt shell surfaces · strip legacy owners", () => {
    const inventory = readText(
      "specs/backend/official-beta-visual-inventory-2026-11-11.md",
    );
    expect(inventory).toContain("@dweb/ui-kit");
    expect(inventory).toContain("globals.css");
    expect(inventory).toContain("conversation-row.tsx");
    expect(inventory).toContain("composer.tsx");
    expect(inventory).toContain("usePeerTrust");
    expect(inventory).toContain("MessagingProvider");
    expect(inventory).toContain("Never `from \"@/app/features/\"`");
    expect(inventory).toContain("≠ Continuity Pass");
    expect(inventory).toContain("Soft L3 Fixed");
  });

  it("keeps Official Beta bar + visual inherit parents", () => {
    const bar = readText("specs/backend/official-beta-bar-2026-11-11.md");
    const inherit = readText(
      "specs/backend/official-beta-visual-inherit-design-2026-11-11.md",
    );
    expect(bar).toContain("OB1");
    expect(bar).toContain("visual inherit");
    expect(inherit).toContain("STRIP:");
    expect(inherit).toContain("apps/desktop-ui");
  });

  it("does not authorize Soft L3 Fixed or Continuity Pass via inventory", () => {
    const inventory = readText(
      "specs/backend/official-beta-visual-inventory-2026-11-11.md",
    );
    expect(inventory).toMatch(/Soft L3 Fixed paused|Soft L3 Fixed/);
    expect(inventory).toContain("≠ Continuity Pass");
    expect(inventory).not.toMatch(/Soft L3 Fixed\s*\*\*Pass\*\*/);
    expect(inventory).not.toMatch(/Continuity Pass\s*\*\*claimed\*\*/);
  });
});
