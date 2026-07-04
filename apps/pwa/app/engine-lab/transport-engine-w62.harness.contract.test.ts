import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w62 — mechanical production subtraction harness", () => {
  it("links W61 archive-aware reads to W62 subtracted port module", () => {
    const w61 = readFromRepo(
      "docs/program/transport-engine-w61-standalone-legacy-production-deletion-execution.md",
    );
    const w62 = readFromRepo(
      "docs/program/transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md",
    );
    expect(w61).toContain("resolveTransportEngineStandaloneLegacyReadPath");
    expect(w62).toContain("relay-standalone-publish-port-subtracted.ts");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W63+ port swap in subtraction charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md",
    );
    expect(charter).toContain("STANDALONE_LEGACY_FILES_TO_DELETE");
    expect(charter).toContain("No deletion of production");
    expect(charter).toContain("W63+");
  });
});
