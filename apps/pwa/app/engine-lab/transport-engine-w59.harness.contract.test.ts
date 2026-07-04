import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w59 — physical deletion execution harness", () => {
  it("links W58 manifest execution to W59 dry-run baseline", () => {
    const w58 = readFromRepo(
      "docs/program/transport-engine-w58-standalone-legacy-file-deletion-execution.md",
    );
    const w59 = readFromRepo(
      "docs/program/transport-engine-w59-standalone-legacy-physical-deletion-execution.md",
    );
    expect(w58).toContain("transport-kernel-standalone-deletion-subtraction-manifest.ts");
    expect(w59).toContain("evaluateStandaloneLegacySubtractionDryRun");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W60+ mechanical deletion in execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w59-standalone-legacy-physical-deletion-execution.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("No deletion of");
    expect(charter).toContain("W60+");
  });
});
