import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shouldRouteHostTransportPublish,
  shouldUseHostTransportPublishAuthority,
  shouldUseHostTransportPublishShim,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w50 — authority-gated port host routing", () => {
  it("pins authority port routing charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w50-authority-gated-port-host-routing.md",
    );
    expect(charter).toContain("Authority-Gated Port Host Routing");
    expect(charter).toContain("shouldRouteHostTransportPublish");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY");
  });

  it("wires shouldRouteHostTransportPublish into relay-standalone-publish-port", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("shouldRouteHostTransportPublish");
    expect(port).toContain("publishHostTransportShimToRelayUrls");
    expect(port).toContain("publishTransportKernelToRelayUrls");
  });

  it("keeps host routing off by default", () => {
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(shouldUseHostTransportPublishShim()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
  });
});
