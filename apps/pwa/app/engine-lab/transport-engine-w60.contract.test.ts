import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { resolveStandaloneLegacyContractReadPath } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-contract-pins";
import {
  evaluateStandaloneLegacySubtractionDryRun,
  type StandaloneLegacySubtractionDryRunFilesystem,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-dry-run";
import {
  STANDALONE_LEGACY_ARCHIVE_PATH,
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
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

const LEGACY_SEMANTIC_TOKENS = [
  "publishTransportKernelToRelay",
  "publishTransportKernelToRelayUrls",
  "relayNativeAdapter",
  "mapLegacyPublishResultToRelayPublishResult",
] as const;

describe("transport-engine w60 — standalone legacy mechanical deletion preparation", () => {
  it("pins mechanical deletion preparation charter with archive policy", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md",
    );
    expect(charter).toContain("Mechanical Deletion Preparation");
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.archive.ts");
    expect(charter).toContain("resolveStandaloneLegacyContractReadPath");
  });

  it("freezes legacy semantics in engine-lab archive fixture", () => {
    const archive = readFileSync(join(PWA_ROOT, STANDALONE_LEGACY_ARCHIVE_PATH), "utf8");
    for (const token of LEGACY_SEMANTIC_TOKENS) {
      expect(archive).toContain(token);
    }
    expect(archive).toContain("W60 frozen archive");
  });

  it("resolves contract read path to production legacy while files remain", () => {
    expect(resolveStandaloneLegacyContractReadPath(true)).toBe(STANDALONE_LEGACY_FILES_TO_DELETE[0]!);
    expect(resolveStandaloneLegacyContractReadPath(false)).toBe(STANDALONE_LEGACY_ARCHIVE_PATH);
  });

  it("requires archive in dry-run baseline while gate is closed", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");

    const report = evaluateStandaloneLegacySubtractionDryRun(recorded, createPwaFilesystem());
    expect(report.legacyArchivePresent).toBe(true);
    expect(report.legacyFilesPresent).toBe(true);
    expect(report.readyForPhysicalDeletion).toBe(false);
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});

describe("transport-engine w60 — archive dry-run gate semantics", () => {
  it("requires archive present for physical deletion readiness when gate opens", () => {
    const passSignOff = "**Decision:** PASS\n";
    const fs = createPwaFilesystem();

    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED", "1");
    expect(evaluateStandaloneLegacySubtractionDryRun(passSignOff, fs).readyForPhysicalDeletion).toBe(true);
    vi.unstubAllEnvs();
  });
});
