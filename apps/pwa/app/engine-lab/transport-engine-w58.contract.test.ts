import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isStandaloneLegacyDeletionApproved,
  parseSmokeSignOffDecision,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import {
  STANDALONE_LEGACY_DELETION_APPROVAL_ENV,
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE,
  STANDALONE_LEGACY_POST_DELETION_PORT_OWNERS,
  STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED,
  STANDALONE_LEGACY_UNIT_TESTS_TO_MIGRATE,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w58 — standalone legacy file deletion execution", () => {
  it("pins file deletion execution charter with manifest reference", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w58-standalone-legacy-file-deletion-execution.md",
    );
    expect(charter).toContain("Standalone Legacy File Deletion Execution");
    expect(charter).toContain("transport-kernel-standalone-deletion-subtraction-manifest.ts");
    expect(charter).toContain("isStandaloneLegacyDeletionApproved");
  });

  it("implements subtraction manifest with deletion targets and preserved semantics owner", () => {
    expect(STANDALONE_LEGACY_FILES_TO_DELETE).toContain(
      "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
    );
    expect(STANDALONE_LEGACY_FILES_TO_DELETE).toContain(
      "app/features/transport-kernel/transport-kernel-standalone-publish.ts",
    );
    expect(STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE).toContain(
      "app/features/relays/hooks/relay-standalone-publish-port.ts",
    );
    expect(STANDALONE_LEGACY_SEMANTICS_OWNER_PRESERVED).toContain("publish-outcome-mapper.ts");
    expect(STANDALONE_LEGACY_POST_DELETION_PORT_OWNERS.length).toBeGreaterThanOrEqual(2);
    expect(STANDALONE_LEGACY_DELETION_APPROVAL_ENV).toBe(
      "NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED",
    );
  });

  it("lists engine-lab contracts and unit tests to migrate on deletion", () => {
    expect(STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE.length).toBeGreaterThanOrEqual(10);
    expect(STANDALONE_LEGACY_UNIT_TESTS_TO_MIGRATE).toContain(
      "app/features/transport-kernel/transport-kernel-standalone-publish.test.ts",
    );
    expect(STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE).toContain(
      "app/engine-lab/transport-engine-w52.contract.test.ts",
    );
  });

  it("blocks physical deletion while recorded sign-off is BLOCKED", () => {
    const recorded = readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF);
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");
    expect(isStandaloneLegacyDeletionApproved(recorded)).toBe(false);
  });

  it("keeps legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }

    const port = readFileSync(
      join(PWA_ROOT, STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE[0]!),
      "utf8",
    );
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
  });
});

describe("transport-engine w58 — manifest contract pins exist on disk", () => {
  it("references migratable contract files that exist before deletion", () => {
    for (const relPath of STANDALONE_LEGACY_ENGINE_LAB_CONTRACTS_TO_MIGRATE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});
