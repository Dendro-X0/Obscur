import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { isStandaloneLegacyDeletionApproved, parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness";
import { STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import { existsSync } from "node:fs";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const createPwaFilesystem = () => ({
  fileExists: (relativePathFromPwaRoot: string) => existsSync(join(PWA_ROOT, relativePathFromPwaRoot)),
  readText: (relativePathFromPwaRoot: string) => readFileSync(join(PWA_ROOT, relativePathFromPwaRoot), "utf8"),
});

describe("transport-engine w66 — mechanical subtraction commit harness", () => {
  it("links W65 pin migration to W66 mechanical commit", () => {
    const w65 = readFromRepo(
      "docs/program/transport-engine-w65-standalone-legacy-existence-pin-migration.md",
    );
    const w66 = readFromRepo(
      "docs/program/transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md",
    );
    expect(w65).toContain("STANDALONE_LEGACY_GATE_CLOSED_EXISTENCE_PIN_CONTRACTS");
    expect(w66).toContain("preCommitBaselineReady");
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
  });

  it("opens mechanical commit readiness only when sign-off PASS and env approval are both set", () => {
    const passSignOff = "**Decision:** PASS\n";
    const fs = createPwaFilesystem();

    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED", "1");
    const approved = evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness(passSignOff, fs);
    expect(isStandaloneLegacyDeletionApproved(passSignOff)).toBe(true);
    expect(approved.preCommitBaselineReady).toBe(true);
    expect(approved.readyForMechanicalSubtractionCommit).toBe(true);
    vi.unstubAllEnvs();

    const blocked = evaluateStandaloneLegacyMechanicalSubtractionCommitReadiness(passSignOff, fs);
    expect(blocked.readyForMechanicalSubtractionCommit).toBe(false);
  });
});
