import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
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

describe("transport-engine w49 — maintainer-gated port default flip charter", () => {
  it("pins authority flip charter separate from shim gate", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w49-maintainer-gated-port-default-flip-charter.md",
    );
    expect(charter).toContain("Maintainer-Gated Port Default Flip Charter");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM");
    expect(charter).toContain("no port routing change");
  });

  it("implements authority gate policy in transport-kernel-publish-port", () => {
    const policy = readFromPwa("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(policy).toContain("shouldUseHostTransportPublishAuthority");
    expect(policy).toContain("shouldRouteHostTransportPublish");
  });

  it("keeps authority and shim gates off by default", () => {
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });
});
