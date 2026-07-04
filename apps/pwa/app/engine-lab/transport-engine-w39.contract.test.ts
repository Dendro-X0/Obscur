import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w39 — host shim + dry-run integration charter", () => {
  it("pins integration charter for shim → host → dry-run → mapper chain", () => {
    const charter = readFromRepo("docs/program/transport-engine-w39-host-shim-dry-run-integration-charter.md");
    expect(charter).toContain("Host Shim + Dry-Run Integration Charter");
    expect(charter).toContain("publishHostTransportShimToRelayUrls");
    expect(charter).toContain("mapLegacyPublishResultToRelayPublishResult");
  });

  it("keeps shim gate off under default policy", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
