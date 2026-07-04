import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w41 — pre-authority-flip exit charter (design-only)", () => {
  it("pins authority-flip exit checklist charter", () => {
    const charter = readFromRepo("docs/program/transport-engine-w41-pre-authority-flip-exit-charter.md");
    expect(charter).toContain("Pre-Authority-Flip Exit Charter");
    expect(charter).toContain("mapLegacyPublishResultToRelayPublishResult");
    expect(charter).toContain("design + contract only");
  });

  it("keeps default port routing on standalone kernel owner", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("publishTransportKernelToRelayUrls");
    expect(port).toContain("shouldRouteHostTransportPublish");
  });

  it("keeps shim gate off under default policy", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
