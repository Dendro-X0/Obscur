import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w61 — production deletion execution harness", () => {
  it("links W60 archive preparation to W61 archive-aware contract reads", () => {
    const w60 = readFromRepo(
      "docs/program/transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md",
    );
    const w61 = readFromRepo(
      "docs/program/transport-engine-w61-standalone-legacy-production-deletion-execution.md",
    );
    expect(w60).toContain("transport-kernel-standalone-publish-legacy.archive.ts");
    expect(w61).toContain("transport-engine-standalone-legacy-contract-read.ts");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W62+ mechanical subtraction in execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w61-standalone-legacy-production-deletion-execution.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("No deletion of production");
    expect(charter).toContain("W62+");
  });
});
