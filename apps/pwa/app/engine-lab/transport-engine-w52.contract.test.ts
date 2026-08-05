import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shouldRouteHostTransportPublish,
  shouldUseHostTransportPublishAuthority,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";
import { resolveTransportEngineStandaloneLegacyReadPath } from "./transport-engine-standalone-legacy-contract-read";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w52 — standalone owner quarantine execution", () => {
  it("pins quarantine execution charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w52-standalone-owner-quarantine-execution.md",
    );
    expect(charter).toContain("Standalone Owner Quarantine Execution");
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("no deletion");
  });

  it("archives implementation after W66 production deletion", () => {
    const legacy = readFromPwa(resolveTransportEngineStandaloneLegacyReadPath(PWA_ROOT));
    expect(legacy).toContain("publishTransportKernelToRelayUrls");
    expect(legacy).toContain("mapLegacyPublishResultToRelayPublishResult");
    expect(legacy).toContain("W60 frozen archive");
  });

  it("switches relay-standalone-publish-port to thin subtracted re-export", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).not.toContain("transport-kernel-standalone-publish-legacy");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
  });

  it("keeps host routing gates off by default", () => {
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
  });
});

describe("transport-engine w52 — quarantine filesystem layout", () => {
  it("production legacy module and facade are absent after W66", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts"))).toBe(true);
  });
});
