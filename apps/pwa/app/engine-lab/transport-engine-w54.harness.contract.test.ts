import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w54 — sign-off template harness", () => {
  it("maps all eight W53 checklist rows in template", () => {
    const template = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-template.md");
    const w53 = readFromRepo(
      "docs/program/transport-engine-w53-live-desktop-publish-smoke-charter.md",
    );

    expect(template.match(/\| [1-8] \|/g)?.length).toBe(8);
    expect(w53).toContain("8. **Sign-off**");
  });

  it("blocks standalone deletion until PASS decision documented", () => {
    const template = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-template.md");
    const charter = readFromRepo(
      "docs/program/transport-engine-w54-smoke-evidence-sign-off-template-charter.md",
    );

    expect(template).toContain("deletion requires `Decision: PASS`");
    expect(charter).toContain("BLOCKED");
    expect(charter).toContain("standalone `-legacy` deletion");
  });
});
