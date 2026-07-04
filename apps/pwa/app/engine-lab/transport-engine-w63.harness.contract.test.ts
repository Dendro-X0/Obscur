import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w63 — port swap rehearsal harness", () => {
  it("links W62 subtracted port to W63 delegation rehearsal", () => {
    const w62 = readFromRepo(
      "docs/program/transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md",
    );
    const w63 = readFromRepo(
      "docs/program/transport-engine-w63-standalone-legacy-port-swap-rehearsal.md",
    );
    expect(w62).toContain("relay-standalone-publish-port-subtracted.ts");
    expect(w63).toContain("shouldRouteSubtractedStandalonePublishPort");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W64+ mechanical subtraction in rehearsal charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w63-standalone-legacy-port-swap-rehearsal.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("No deletion of production");
    expect(charter).toContain("W64+");
  });
});
