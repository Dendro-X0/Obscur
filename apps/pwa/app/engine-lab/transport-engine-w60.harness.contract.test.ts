import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_ARCHIVE_PATH, STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w60 — mechanical deletion preparation harness", () => {
  it("links W59 dry-run baseline to W60 archive preparation", () => {
    const w59 = readFromRepo(
      "docs/program/transport-engine-w59-standalone-legacy-physical-deletion-execution.md",
    );
    const w60 = readFromRepo(
      "docs/program/transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md",
    );
    expect(w59).toContain("evaluateStandaloneLegacySubtractionDryRun");
    expect(w60).toContain(STANDALONE_LEGACY_ARCHIVE_PATH.split("/").pop()!);
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W61+ mechanical deletion in preparation charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("No deletion of production");
    expect(charter).toContain("W61+");
  });
});
