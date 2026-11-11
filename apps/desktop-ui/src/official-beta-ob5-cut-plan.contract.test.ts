import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Official Beta OB5 cut plan", () => {
  it("locks OB5 cut plan honesty for Official Beta publish", () => {
    const plan = readText("specs/backend/official-beta-ob5-cut-plan-2026-11-11.md");
    expect(plan).toContain("v2.0.0-beta.11");
    expect(plan).toContain("CLOSED Published");
    expect(plan).toContain("≠ Continuity Pass");
    expect(plan).toContain("Soft L3 Fixed");
    expect(plan).not.toMatch(/Soft L3 Fixed\s*\*\*Pass\*\*/);
    expect(plan).not.toMatch(/Continuity Pass\s*\*\*claimed\*\*/);
  });

  it("promotes Official Beta release notes for beta.11", () => {
    const notes = readText("docs/releases/v2.0.0-beta.11-release.md");
    expect(notes).toContain("Official Beta");
    expect(notes).toContain("**Published**");
    expect(notes).toContain("v2.0.0-beta.11");
    expect(notes).toContain("Continuity Pass");
    expect(notes).toContain("Soft L3 Fixed");
    expect(notes).toContain("not claimed");
  });

  it("bumps version.json releaseTag to Official Beta", () => {
    const version = JSON.parse(readText("version.json")) as {
      releaseTag?: string;
    };
    expect(version.releaseTag).toBe("2.0.0-beta.11");
  });

  it("keeps Official Beta bar honesty on publish", () => {
    const bar = readText("specs/backend/official-beta-bar-2026-11-11.md");
    expect(bar).toContain("OB5");
    expect(bar).toContain("Published Official Beta");
    expect(bar).toContain("Soft L3 Fixed");
  });
});
