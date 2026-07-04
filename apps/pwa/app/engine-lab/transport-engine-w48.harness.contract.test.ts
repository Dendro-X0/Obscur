import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const REQUIRED_EVIDENCE_CHARTERS = [
  "docs/program/transport-engine-w41-pre-authority-flip-exit-charter.md",
  "docs/program/transport-engine-w47-network-publish-parity-harness-charter.md",
  "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
  "docs/program/transport-engine-w30-host-publish-owner-migration-charter.md",
] as const;

const REQUIRED_HARNESS_TESTS = [
  "apps/pwa/app/engine-lab/transport-engine-w39.harness.contract.test.ts",
  "apps/pwa/app/engine-lab/transport-engine-w47.harness.contract.test.ts",
] as const;

describe("transport-engine w48 — exit evidence harness matrix", () => {
  it("pins required authority-flip evidence charters on disk", () => {
    for (const charterPath of REQUIRED_EVIDENCE_CHARTERS) {
      const charter = readFromRepo(charterPath);
      expect(charter.length).toBeGreaterThan(0);
    }
  });

  it("pins dry-run and network parity harness contract files", () => {
    for (const harnessPath of REQUIRED_HARNESS_TESTS) {
      const harness = readFromRepo(harnessPath);
      expect(harness).toContain("describe(");
    }
  });

  it("documents subtraction plan without deleting standalone owner", () => {
    const review = readFromRepo(
      "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
    );
    expect(review).toContain("Subtraction plan");
    expect(review).toContain("not executed in W48");

    const standalone = readFromRepo(
      "apps/pwa/app/features/transport-kernel/transport-kernel-standalone-publish.ts",
    );
    expect(standalone).toContain("publishTransportKernelToRelayUrls");
  });
});
