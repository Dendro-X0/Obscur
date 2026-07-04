import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const QUARANTINE_PHASES = [
  {
    phase: "W51 design",
    standalonePath: "app/features/transport-kernel/transport-kernel-standalone-publish.ts",
    legacyExists: false,
  },
  {
    phase: "W52 target",
    standalonePath: "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
    legacyExists: false,
  },
] as const;

describe("transport-engine w51 — quarantine phase harness matrix", () => {
  it("pins w51 design-era layout in charter (legacy module added in w52)", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("W52");
  });

  it("documents quarantine phases in charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    for (const entry of QUARANTINE_PHASES) {
      expect(charter).toContain(entry.standalonePath.split("/").pop() ?? entry.standalonePath);
    }
    expect(charter).toContain("W52");
  });

  it("preserves shared mapper as semantics owner through quarantine plan", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    expect(charter).toContain("publish-outcome-mapper.ts");

    const standalone = readFromRepo(
      "apps/pwa/app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts",
    );
    expect(standalone).toContain("mapLegacyPublishResultToRelayPublishResult");
  });
});
