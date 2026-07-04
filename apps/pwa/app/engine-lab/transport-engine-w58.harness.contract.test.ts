import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w58 — file deletion execution harness", () => {
  it("links W57 fail-closed subtraction to W58 manifest execution", () => {
    const w57 = readFromRepo(
      "docs/program/transport-engine-w57-standalone-legacy-deletion-subtraction.md",
    );
    const w58 = readFromRepo(
      "docs/program/transport-engine-w58-standalone-legacy-file-deletion-execution.md",
    );
    expect(w57).toContain("shouldBlockStandaloneLegacyPublishFallback");
    expect(w58).toContain("transport-kernel-standalone-deletion-subtraction-manifest.ts");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents W59+ physical deletion in execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w58-standalone-legacy-file-deletion-execution.md",
    );
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("No deletion of");
    expect(charter).toContain("W59+");
  });
});
