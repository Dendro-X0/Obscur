import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isStandaloneLegacyDeletionApproved,
  parseSmokeSignOffDecision,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const createPwaFilesystem = (): StandaloneLegacySubtractionDryRunFilesystem => ({
  fileExists: (relativePathFromPwaRoot) => existsSync(join(PWA_ROOT, relativePathFromPwaRoot)),
  readText: (relativePathFromPwaRoot) => readFileSync(join(PWA_ROOT, relativePathFromPwaRoot), "utf8"),
});

describe("transport-engine w59 — standalone legacy physical deletion execution", () => {
  it("pins physical deletion execution charter with dry-run policy", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w59-standalone-legacy-physical-deletion-execution.md",
    );
    expect(charter).toContain("Standalone Legacy Physical Deletion Execution");
    expect(charter).toContain("evaluateStandaloneLegacySubtractionDryRun");
    expect(charter).toContain("readyForPhysicalDeletion");
  });

  it("implements dry-run evaluator in transport-kernel", () => {
    const module = readFileSync(
      join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run.ts"),
      "utf8",
    );
    expect(module).toContain("evaluateStandaloneLegacySubtractionDryRun");
    expect(module).toContain("isStandaloneLegacyDeletionApproved");
  });

  it("reports baseline ready while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacySubtractionDryRun(recorded, createPwaFilesystem());
    expect(report.gateApproved).toBe(false);
    expect(report.legacyFilesPresent).toBe(true);
    expect(report.legacyArchivePresent).toBe(true);
    expect(report.portImportsLegacy).toBe(true);
    expect(report.subtractedPortPresent).toBe(true);
    expect(report.subtractedPortOmitsLegacyImport).toBe(true);
    expect(report.thinPortTemplatePresent).toBe(true);
    expect(report.thinPortOmitsLegacyImport).toBe(true);
    expect(report.postDeletionOwnersPresent).toBe(true);
    expect(report.semanticsOwnerPresent).toBe(true);
    expect(report.contractPinsPresent).toBe(true);
    expect(report.unitTestPinsPresent).toBe(true);
    expect(report.existencePinMigrationReady).toBe(true);
    expect(report.mechanicalSubtractionCommitReady).toBe(true);
    expect(report.b5ExitVerificationReady).toBe(true);
    expect(report.prepBandClosureReady).toBe(true);
    expect(report.readyForPhysicalDeletion).toBe(false);
  });

  it("keeps legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});

describe("transport-engine w59 — dry-run gate semantics", () => {
  it("opens physical deletion readiness only when sign-off PASS and env approval are both set", () => {
    const passSignOff = "**Decision:** PASS\n";
    const fs = createPwaFilesystem();

    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED", "1");
    const approved = evaluateStandaloneLegacySubtractionDryRun(passSignOff, fs);
    expect(isStandaloneLegacyDeletionApproved(passSignOff)).toBe(true);
    expect(approved.readyForPhysicalDeletion).toBe(true);
    vi.unstubAllEnvs();

    const blocked = evaluateStandaloneLegacySubtractionDryRun(passSignOff, fs);
    expect(blocked.readyForPhysicalDeletion).toBe(false);
  });
});
