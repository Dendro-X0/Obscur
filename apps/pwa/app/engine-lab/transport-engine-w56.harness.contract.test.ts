import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w56 — deletion execution harness", () => {
  it("links recorded sign-off file to W55 deletion gate", () => {
    const recorded = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-recorded.md");
    const w55 = readFromRepo(
      "docs/program/transport-engine-w55-standalone-legacy-deletion-charter.md",
    );
    expect(recorded).toContain("transport-engine-smoke-sign-off-template.md");
    expect(w55).toContain("transport-engine-smoke-sign-off-template.md");
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");
  });

  it("documents W57 subtraction steps in execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w56-standalone-legacy-deletion-execution.md",
    );
    expect(charter).toContain("W57");
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("no file deletion");
  });
});
