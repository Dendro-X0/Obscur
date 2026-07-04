import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const SUBTRACTION_TARGETS = [
  "transport-kernel-standalone-publish-legacy.ts",
  "transport-kernel-standalone-publish.ts",
  "relay-standalone-publish-port.ts",
  "mapLegacyPublishResultToRelayPublishResult",
] as const;

describe("transport-engine w55 — deletion gate harness", () => {
  it("documents subtraction targets without executing deletion", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w55-standalone-legacy-deletion-charter.md",
    );
    expect(charter).toContain("BLOCKED");
    expect(charter).toContain("No deletion");
    for (const target of SUBTRACTION_TARGETS) {
      expect(charter).toContain(target);
    }
  });

  it("requires W54 PASS before W56 execution", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w55-standalone-legacy-deletion-charter.md",
    );
    const w54 = readFromRepo(
      "docs/program/transport-engine-w54-smoke-evidence-sign-off-template-charter.md",
    );
    expect(charter).toContain("W54 sign-off");
    expect(w54).toContain("Decision: PASS");
  });
});
