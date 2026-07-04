import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_CHARTER,
  STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_COMMIT_STEPS,
  STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_SCRIPT,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-mechanical-subtraction-commit";
import { evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import type { StandaloneLegacySubtractionDryRunFilesystem } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const createPwaFilesystem = (): StandaloneLegacySubtractionDryRunFilesystem => ({
  fileExists: (relativePathFromPwaRoot) => existsSync(join(PWA_ROOT, relativePathFromPwaRoot)),
  readText: (relativePathFromPwaRoot) => readFileSync(join(PWA_ROOT, relativePathFromPwaRoot), "utf8"),
});

describe("transport-engine w66 — standalone legacy mechanical subtraction commit", () => {
  it("pins mechanical subtraction commit charter with ordered steps", () => {
    const charter = readFromRepo(STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_CHARTER);
    expect(charter).toContain("Mechanical Subtraction Commit");
    expect(charter).toContain("evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness");
    expect(charter).toContain(STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_SCRIPT);
    expect(STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_COMMIT_STEPS).toHaveLength(7);
  });

  it("implements mechanical commit step manifest in transport-kernel", () => {
    const module = readFileSync(
      join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-deletion-mechanical-subtraction-commit.ts"),
      "utf8",
    );
    expect(module).toContain("STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_COMMIT_STEPS");
    expect(module).toContain("relay-standalone-publish-port-thin.ts");
    expect(module).toContain("STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS");
  });

  it("reports pre-commit baseline ready while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness(
      recorded,
      createPwaFilesystem(),
    );
    expect(report.gateApproved).toBe(false);
    expect(report.preCommitBaselineReady).toBe(true);
    expect(report.existencePinMigrationReady).toBe(true);
    expect(report.postSubtractionComplete).toBe(false);
    expect(report.readyForMechanicalSubtractionCommit).toBe(false);
  });

  it("documents maintainer gate script in repo", () => {
    const script = readFromRepo(STANDALONE_LEGACY_MECHANICAL_SUBTRACTION_SCRIPT);
    expect(script).toContain("execute-transport-standalone-legacy-subtraction: BLOCKED");
    expect(script).toContain("relay-standalone-publish-port-thin.ts");
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
