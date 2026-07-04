import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS,
  STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-existence-pin-migration";
import { evaluateStandaloneLegacyExistencePinMigrationReadiness } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-existence-pin-migration-readiness";
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

describe("transport-engine w65 — standalone legacy existence pin migration", () => {
  it("pins existence pin migration charter with w55–w64 inventory", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w65-standalone-legacy-existence-pin-migration.md",
    );
    expect(charter).toContain("Existence Pin Migration");
    expect(charter).toContain("STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS");
    expect(charter).toContain("evaluateStandaloneLegacyExistencePinMigrationReadiness");
    expect(charter).toContain("w55–w64");
  });

  it("implements gate-closed existence pin inventory in transport-kernel", () => {
    const module = readFileSync(
      join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-deletion-existence-pin-migration.ts"),
      "utf8",
    );
    expect(module).toContain("STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS");
    expect(module).toContain("STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS");
    expect(STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS).toHaveLength(10);
  });

  it("reports pin migration readiness while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacyExistencePinMigrationReadiness(createPwaFilesystem());
    expect(report.pinContractsPresent).toBe(true);
    expect(report.gateClosedPinsAssertLegacyPresent).toBe(true);
    expect(report.pinContractCount).toBe(10);
    expect(report.readyForPinFlipAfterSubtraction).toBe(true);
  });

  it("keeps gate-closed markers in every inventoried pin contract", () => {
    for (const relPath of STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS) {
      const text = readFileSync(join(PWA_ROOT, relPath), "utf8");
      const hasMarker = STANDALONE_LEGACY_GATE_CLOSED_PIN_MARKERS.some((marker) => text.includes(marker));
      expect(hasMarker, relPath).toBe(true);
    }
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
