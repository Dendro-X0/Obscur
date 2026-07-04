import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_B5_EXIT_CRITERIA } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-b5-exit";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w67 — B5 exit verification harness", () => {
  it("links W66 mechanical commit to W67 B5 exit verification", () => {
    const w66 = readFromRepo(
      "docs/program/transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md",
    );
    const w67 = readFromRepo(
      "docs/program/transport-engine-w67-standalone-legacy-b5-exit-verification.md",
    );
    expect(w66).toContain("postSubtractionComplete");
    expect(w67).toContain("readyForB5ExitVerification");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents verify gate in B5 exit criteria", () => {
    const criteria = STANDALONE_LEGACY_B5_EXIT_CRITERIA.join("\n");
    expect(criteria).toContain("verify:transport-engine-w67");
    expect(criteria).toContain("verify:engine-lab");
    expect(criteria).toContain("postSubtractionComplete");
  });
});
