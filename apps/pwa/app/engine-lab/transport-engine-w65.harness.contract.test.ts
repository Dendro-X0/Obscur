import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { STANDALONE_LEGACY_POST_SUBTRACTION_PIN_MARKERS } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-existence-pin-migration";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w65 — existence pin migration harness", () => {
  it("links W64 production deletion to W65 pin migration", () => {
    const w64 = readFromRepo(
      "docs/program/transport-engine-w64-standalone-legacy-production-deletion-execution.md",
    );
    const w65 = readFromRepo(
      "docs/program/transport-engine-w65-standalone-legacy-existence-pin-migration.md",
    );
    expect(w64).toContain("gate-closed existence contract pins");
    expect(w65).toContain("thin port");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("documents post-subtraction pin flip markers in migration module", () => {
    const migration = readFromRepo(
      "apps/pwa/app/features/transport-kernel/transport-kernel-standalone-deletion-existence-pin-migration.ts",
    );
    for (const marker of STANDALONE_LEGACY_POST_SUBTRACTION_PIN_MARKERS) {
      expect(migration).toContain(marker);
    }
  });
});
