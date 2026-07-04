import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STANDALONE_LEGACY_B5_EXIT_CHARTER,
  STANDALONE_LEGACY_B5_EXIT_CRITERIA,
  STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-b5-exit";
import { evaluateStandaloneLegacyB5ExitReadiness } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-b5-exit-readiness";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED,
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

describe("transport-engine w67 — standalone legacy B5 exit verification", () => {
  it("pins B5 exit verification charter with exit criteria", () => {
    const charter = readFromRepo(STANDALONE_LEGACY_B5_EXIT_CHARTER);
    expect(charter).toContain("B5 Exit Verification");
    expect(charter).toContain("evaluateStandaloneLegacyB5ExitReadiness");
    expect(charter).toContain("postSubtractionComplete");
    expect(STANDALONE_LEGACY_B5_EXIT_CRITERIA).toHaveLength(6);
  });

  it("implements B5 exit criteria in transport-kernel", () => {
    const module = readFileSync(
      join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-deletion-b5-exit.ts"),
      "utf8",
    );
    expect(module).toContain("STANDALONE_LEGACY_B5_EXIT_CRITERIA");
    expect(module).toContain("STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED");
    expect(STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS).toHaveLength(3);
  });

  it("reports pre-exit baseline ready while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacyB5ExitReadiness(recorded, createPwaFilesystem());
    expect(report.preExitBaselineReady).toBe(true);
    expect(report.postDeletionOwnersPresent).toBe(true);
    expect(report.semanticsOwnerPresent).toBe(true);
    expect(report.postSubtractionExitComplete).toBe(false);
    expect(report.readyForB5ExitVerification).toBe(false);
  });

  it("keeps semantics owner and post-deletion port owners on disk", () => {
    expect(existsSync(join(PWA_ROOT, STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED))).toBe(true);
    for (const relPath of STANDALONE_LEGACY_B5_EXIT_POST_DELETION_OWNERS) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
