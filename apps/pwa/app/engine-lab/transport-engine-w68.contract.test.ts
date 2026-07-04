import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_CHARTER,
  STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_WAVES,
  STANDALONE_LEGACY_SUBTRACTION_PREP_VERIFY_SCRIPT,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure";
import { evaluateStandaloneLegacySubtractionPrepBandClosure } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness";
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

describe("transport-engine w68 — standalone legacy subtraction prep band closure", () => {
  it("pins prep band closure charter with w55–w67 band complete", () => {
    const charter = readFromRepo(STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_CHARTER);
    expect(charter).toContain("Prep Band Closure");
    expect(charter).toContain("evaluateStandaloneLegacySubtractionPrepBandClosure");
    expect(charter).toContain("no w69+ prep");
    expect(STANDALONE_LEGACY_SUBTRACTION_PREP_BAND_WAVES).toHaveLength(13);
  });

  it("implements consolidated prep band readiness in transport-kernel", () => {
    const module = readFileSync(
      join(
        PWA_ROOT,
        "app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts",
      ),
      "utf8",
    );
    expect(module).toContain("evaluateStandaloneLegacySubtractionPrepBandClosure");
    expect(module).toContain("prepBandComplete");
    expect(module).toContain("readyForMaintainerExecution");
  });

  it("reports prep band complete while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacySubtractionPrepBandClosure(recorded, createPwaFilesystem());
    expect(report.gateApproved).toBe(false);
    expect(report.prepBandComplete).toBe(true);
    expect(report.dryRunReady).toBe(true);
    expect(report.mechanicalCommitReady).toBe(true);
    expect(report.pinMigrationReady).toBe(true);
    expect(report.b5ExitPrepReady).toBe(true);
    expect(report.postSubtractionExitComplete).toBe(false);
    expect(report.readyForMaintainerExecution).toBe(false);
  });

  it("documents read-only prep verify script in repo", () => {
    const script = readFromRepo(STANDALONE_LEGACY_SUBTRACTION_PREP_VERIFY_SCRIPT);
    expect(script).toContain("verify-standalone-legacy-subtraction-prep");
    expect(script).toContain("prepBandComplete");
    expect(script).not.toContain("unlinkSync");
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
