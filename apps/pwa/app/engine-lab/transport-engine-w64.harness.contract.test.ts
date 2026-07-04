import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w64 — production deletion execution harness", () => {
  it("links W63 port rehearsal to W64 thin port subtraction", () => {
    const w63 = readFromRepo(
      "docs/program/transport-engine-w63-standalone-legacy-port-swap-rehearsal.md",
    );
    const w64 = readFromRepo(
      "docs/program/transport-engine-w64-standalone-legacy-production-deletion-execution.md",
    );
    expect(w63).toContain("relay-standalone-publish-port-subtracted");
    expect(w64).toContain("relay-standalone-publish-port-thin.ts");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents maintainer subtraction steps in execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w64-standalone-legacy-production-deletion-execution.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("postSubtractionComplete");
    expect(charter).toContain("No deletion of production");
  });
});
