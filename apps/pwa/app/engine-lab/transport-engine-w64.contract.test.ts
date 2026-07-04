import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run";
import { evaluateStandaloneLegacyPostSubtractionBaseline } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-post-subtraction-baseline";
import { STANDALONE_LEGACY_PORT_IMPORT_TOKEN } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-contract-pins";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_THIN_PORT_PATH,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const createPwaFilesystem = (): StandaloneLegacySubtractionDryRunFilesystem => ({
  fileExists: (relativePathFromPwaRoot) => existsSync(join(PWA_ROOT, relativePathFromPwaRoot)),
  readText: (relativePathFromPwaRoot) => readFileSync(join(PWA_ROOT, relativePathFromPwaRoot), "utf8"),
});

describe("transport-engine w64 — standalone legacy production deletion execution", () => {
  it("pins production deletion execution charter with thin port template", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w64-standalone-legacy-production-deletion-execution.md",
    );
    expect(charter).toContain("Production Deletion Execution");
    expect(charter).toContain("relay-standalone-publish-port-thin.ts");
    expect(charter).toContain("evaluateStandaloneLegacyPostSubtractionBaseline");
    expect(charter).toContain("execute-transport-standalone-legacy-subtraction.mjs");
  });

  it("implements thin port template without legacy standalone import", () => {
    const thin = readFileSync(join(PWA_ROOT, STANDALONE_LEGACY_THIN_PORT_PATH), "utf8");
    expect(thin).toContain("publishToRelayStandaloneSubtracted as publishToRelayStandalone");
    expect(thin).toContain("publishToUrlsStandaloneSubtracted as publishToUrlsStandalone");
    expect(thin).toContain("relay-standalone-publish-port-subtracted");
    expect(thin).not.toContain(STANDALONE_LEGACY_PORT_IMPORT_TOKEN);
  });

  it("includes thin port template readiness in pre-deletion dry-run baseline", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacySubtractionDryRun(recorded, createPwaFilesystem());
    expect(report.thinPortTemplatePresent).toBe(true);
    expect(report.thinPortOmitsLegacyImport).toBe(true);
    expect(report.readyForPhysicalDeletion).toBe(false);
  });

  it("reports post-subtraction baseline incomplete while legacy files remain", () => {
    const report = evaluateStandaloneLegacyPostSubtractionBaseline(createPwaFilesystem());
    expect(report.legacyFilesAbsent).toBe(false);
    expect(report.portOmitsLegacyImport).toBe(false);
    expect(report.thinPortTemplatePresent).toBe(true);
    expect(report.thinPortOmitsLegacyImport).toBe(true);
    expect(report.postSubtractionComplete).toBe(false);
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
