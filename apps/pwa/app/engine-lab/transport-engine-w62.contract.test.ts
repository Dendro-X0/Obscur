import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE,
  STANDALONE_LEGACY_SUBTRACTED_PORT_PATH,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import { STANDALONE_LEGACY_PORT_IMPORT_TOKEN } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-contract-pins";
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

describe("transport-engine w62 — standalone legacy mechanical production subtraction", () => {
  it("pins mechanical production subtraction charter with subtracted port module", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md",
    );
    expect(charter).toContain("Mechanical Production Subtraction");
    expect(charter).toContain("relay-standalone-publish-port-subtracted.ts");
    expect(charter).toContain("W63+");
  });

  it("implements subtracted port without legacy standalone import", () => {
    const subtracted = readFileSync(join(PWA_ROOT, STANDALONE_LEGACY_SUBTRACTED_PORT_PATH), "utf8");
    expect(subtracted).toContain("publishToRelayStandaloneSubtracted");
    expect(subtracted).toContain("publishStandaloneLegacyBlockedToRelay");
    expect(subtracted).toContain("publishHostTransportShimToRelay");
    expect(subtracted).not.toContain(STANDALONE_LEGACY_PORT_IMPORT_TOKEN);
  });

  it("keeps current port importing legacy while gate is closed", () => {
    const port = readFileSync(join(PWA_ROOT, STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE[0]!), "utf8");
    expect(port).toContain(STANDALONE_LEGACY_PORT_IMPORT_TOKEN);
    expect(port).toContain("shouldRouteSubtractedStandalonePublishPort");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
  });

  it("includes subtracted port readiness in dry-run baseline", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacySubtractionDryRun(recorded, createPwaFilesystem());
    expect(report.subtractedPortPresent).toBe(true);
    expect(report.subtractedPortOmitsLegacyImport).toBe(true);
    expect(report.portImportsLegacy).toBe(true);
    expect(report.readyForPhysicalDeletion).toBe(false);
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
