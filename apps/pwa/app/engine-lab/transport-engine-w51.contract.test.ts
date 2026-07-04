import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shouldRouteHostTransportPublish,
  shouldUseHostTransportPublishAuthority,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w51 — standalone owner quarantine charter", () => {
  it("pins quarantine charter with legacy target path", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    expect(charter).toContain("Standalone Owner Quarantine Charter");
    expect(charter).toContain("transport-kernel-standalone-publish-legacy.ts");
    expect(charter).toContain("design-only");
    expect(charter).toContain("verify:transport-engine-w47");
    expect(charter).toContain("verify:transport-engine-w50");
  });

  it("pins w51 design-era charter (execution deferred to w52)", () => {
    const standalone = readFromPwa("app/features/transport-kernel/transport-kernel-standalone-publish.ts");
    expect(standalone).toContain("publishTransportKernelToRelayUrls");

    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    expect(charter).toContain("No rename/move");
  });

  it("references W48 subtraction plan without executing quarantine", () => {
    const review = readFromRepo(
      "docs/program/transport-engine-w48-pre-authority-flip-exit-evidence-review.md",
    );
    expect(review).toContain("Subtraction plan");
    expect(review).toContain("transport-kernel-standalone-publish.ts");

    const charter = readFromRepo(
      "docs/program/transport-engine-w51-standalone-owner-quarantine-charter.md",
    );
    expect(charter).toContain("No rename/move");
  });

  it("keeps host routing gates off by default", () => {
    expect(shouldUseHostTransportPublishAuthority()).toBe(false);
    expect(shouldRouteHostTransportPublish()).toBe(false);
  });
});
