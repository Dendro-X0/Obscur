import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveStandaloneLegacyContractReadPath } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-contract-pins";
import {
  STANDALONE_LEGACY_ARCHIVE_PATH,
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import {
  isStandaloneLegacyProductionPresent,
  resolveTransportEngineStandaloneLegacyReadPath,
} from "./transport-engine-standalone-legacy-contract-read";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const LEGACY_SEMANTIC_TOKENS = [
  "publishTransportKernelToRelayUrls",
  "mapLegacyPublishResultToRelayPublishResult",
] as const;

describe("transport-engine w61 — standalone legacy production deletion execution", () => {
  it("pins production deletion execution charter with archive-aware contract reads", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w61-standalone-legacy-production-deletion-execution.md",
    );
    expect(charter).toContain("Standalone Legacy Production Deletion Execution");
    expect(charter).toContain("resolveTransportEngineStandaloneLegacyReadPath");
    expect(charter).toContain("W62+");
  });

  it("implements disk-aware contract read resolver in engine-lab", () => {
    const module = readFileSync(
      join(PWA_ROOT, "app/engine-lab/transport-engine-standalone-legacy-contract-read.ts"),
      "utf8",
    );
    expect(module).toContain("resolveTransportEngineStandaloneLegacyReadPath");
    expect(module).toContain("isStandaloneLegacyProductionPresent");
  });

  it("resolves production legacy read path while files remain on disk", () => {
    expect(isStandaloneLegacyProductionPresent(PWA_ROOT)).toBe(true);
    expect(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT)).toBe(
      STANDALONE_LEGACY_FILES_TO_DELETE[0]!,
    );

    const legacy = readFileSync(
      join(PWA_ROOT, resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT)),
      "utf8",
    );
    for (const token of LEGACY_SEMANTIC_TOKENS) {
      expect(legacy).toContain(token);
    }
  });

  it("would resolve archive path when production legacy files are absent", () => {
    expect(resolveStandaloneLegacyContractReadPath(false)).toBe(STANDALONE_LEGACY_ARCHIVE_PATH);
    expect(resolveStandaloneLegacyContractReadPath(true)).toBe(STANDALONE_LEGACY_FILES_TO_DELETE[0]!);
  });

  it("blocks production deletion while recorded sign-off is BLOCKED", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});

describe("transport-engine w61 — migrated semantic contract pins", () => {
  it("w14 reads standalone owner through archive-aware resolver", () => {
    const test = readFileSync(join(PWA_ROOT, "app/engine-lab/transport-engine-w14.contract.test.ts"), "utf8");
    expect(test).toContain("resolveTransportEngineStandaloneLegacyReadPath");
  });

  it("w52 reads quarantined owner through archive-aware resolver", () => {
    const test = readFileSync(join(PWA_ROOT, "app/engine-lab/transport-engine-w52.contract.test.ts"), "utf8");
    expect(test).toContain("resolveTransportEngineStandaloneLegacyReadPath");
  });
});
