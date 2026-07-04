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

describe("transport-engine w38 — engine-lab host publish shim gate", () => {
  it("pins lab-only shim gate charter and policy wiring", () => {
    const charter = readFromRepo("docs/program/transport-engine-w38-engine-lab-shim-gate-charter.md");
    expect(charter).toContain("Engine-Lab Host Publish Shim Gate Charter");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM");
    expect(charter).toContain("isEngineLabStrictMode");
  });

  it("implements three-part gate in transport-kernel-publish-port", () => {
    const policy = readFromPwa("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(policy).toContain("isEngineLabStrictMode");
    expect(policy).toContain("isTransportKernelPublishOwner");
    expect(policy).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM");
  });

  it("keeps shim gate off by default in tests", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
