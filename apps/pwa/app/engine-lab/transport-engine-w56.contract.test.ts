import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isStandaloneLegacyDeletionApproved,
  isStandaloneLegacyDeletionEnvApprovedForPolicy,
  parseSmokeSignOffDecision,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w56 — standalone legacy deletion execution gate", () => {
  it("pins deletion execution charter with gate policy", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w56-standalone-legacy-deletion-execution.md",
    );
    expect(charter).toContain("Standalone Legacy Deletion Execution");
    expect(charter).toContain("isStandaloneLegacyDeletionApproved");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED");
  });

  it("implements deletion gate in transport-kernel-standalone-deletion-gate", () => {
    const gate = readFromPwa("app/features/transport-kernel/transport-kernel-standalone-deletion-gate.ts");
    expect(gate).toContain("parseSmokeSignOffDecision");
    expect(gate).toContain("isStandaloneLegacyDeletionApproved");
  });

  it("blocks deletion with recorded sign-off BLOCKED", () => {
    const recorded = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-recorded.md");
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");
    expect(isStandaloneLegacyDeletionApproved(recorded)).toBe(false);
    expect(isStandaloneLegacyDeletionEnvApprovedForPolicy()).toBe(false);
  });

  it("keeps legacy module, facade, and port fallback while gate is closed", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts"))).toBe(true);
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish.ts"))).toBe(true);

    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
  });
});

describe("transport-engine w56 — deletion gate semantics", () => {
  it("opens gate only when sign-off PASS and env approval are both set", () => {
    const passSignOff = "**Decision:** PASS\n";
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED", "1");
    expect(isStandaloneLegacyDeletionApproved(passSignOff)).toBe(true);
    vi.unstubAllEnvs();

    expect(isStandaloneLegacyDeletionApproved(passSignOff)).toBe(false);
    expect(isStandaloneLegacyDeletionApproved("**Decision:** BLOCKED")).toBe(false);
  });
});
