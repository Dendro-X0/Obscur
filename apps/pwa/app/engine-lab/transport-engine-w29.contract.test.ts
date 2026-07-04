import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const HARNESS_SLICES = [
  "app/engine-lab/transport-engine-w24.contract.test.ts",
  "app/engine-lab/transport-engine-w25.contract.test.ts",
  "app/engine-lab/transport-engine-w26.contract.test.ts",
  "app/engine-lab/transport-engine-w27.contract.test.ts",
  "app/engine-lab/transport-engine-w28.contract.test.ts",
] as const;

describe("transport-engine w29 — publish parity harness exit charter", () => {
  it("pins harness exit charter and W24–W28 slice inventory", () => {
    const charter = readFromRepo("docs/program/transport-engine-w29-publish-parity-harness-exit-charter.md");
    expect(charter).toContain("Publish Parity Harness Exit Charter");
    expect(charter).toContain("W24–W28");
    expect(charter).toContain("transport_publish_invalid_result");
    expect(charter).toContain("transport_publish_invoke_failed");
    expect(charter).toContain("design + contract only");
  });

  it("pins executable harness contract files for W24–W28", () => {
    for (const rel of HARNESS_SLICES) {
      expect(existsSync(join(PWA_ROOT, rel))).toBe(true);
    }
  });

  it("keeps semantic baseline owners and Rust not-wired stub for valid invokes", () => {
    const mapper = readFromPwa("app/features/relays/lib/publish-outcome-mapper.ts");
    expect(mapper).toContain("mapLegacyPublishResultToRelayPublishResult");

    const standaloneOwner = readFromPwa("app/features/transport-kernel/transport-kernel-standalone-publish.ts");
    expect(standaloneOwner).toContain("publishTransportKernelToRelayUrls");

    const rust = readFromRepo("packages/libobscur/src/engine_invoke.rs");
    expect(rust).toContain("assemble_transport_publish_relay_event_dry_run");
  });
});
