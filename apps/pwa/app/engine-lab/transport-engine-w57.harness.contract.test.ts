import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w57 — deletion subtraction harness", () => {
  it("links W56 gate to W57 fail-closed subtraction charter", () => {
    const w56 = readFromRepo(
      "docs/program/transport-engine-w56-standalone-legacy-deletion-execution.md",
    );
    const w57 = readFromRepo(
      "docs/program/transport-engine-w57-standalone-legacy-deletion-subtraction.md",
    );
    expect(w56).toContain("isStandaloneLegacyDeletionApproved");
    expect(w57).toContain("shouldBlockStandaloneLegacyPublishFallback");
    expect(parseSmokeSignOffDecision(
      readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-recorded.md"),
    )).toBe("BLOCKED");
  });

  it("documents file deletion in W58+ maintainer commit", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w57-standalone-legacy-deletion-subtraction.md",
    );
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("No deletion of");
  });
});
