import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w68 — prep band closure harness", () => {
  it("links W67 B5 exit to W68 prep band closure", () => {
    const w67 = readFromRepo(
      "docs/program/transport-engine-w67-standalone-legacy-b5-exit-verification.md",
    );
    const w68 = readFromRepo(
      "docs/program/transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md",
    );
    expect(w67).toContain("readyForB5ExitVerification");
    expect(w68).toContain("prepBandComplete");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents maintainer-only execution after prep band closure", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md",
    );
    expect(charter).toContain("execute-transport-standalone-legacy-subtraction.mjs");
    expect(charter).toContain("PAUSED");
    expect(charter).toContain("W53");
  });
});
