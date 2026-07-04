import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  isStandaloneLegacyDeletionApproved,
  parseSmokeSignOffDecision,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";
import { shouldBlockStandaloneLegacyPublishFallback } from "@/app/features/transport-kernel/transport-kernel-publish-port";
import { STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE } from "@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w57 — standalone legacy deletion subtraction", () => {
  it("pins subtraction charter with fail-closed routing and W58+ steps", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w57-standalone-legacy-deletion-subtraction.md",
    );
    expect(charter).toContain("Standalone Legacy Deletion Subtraction");
    expect(charter).toContain("shouldBlockStandaloneLegacyPublishFallback");
    expect(charter).toContain("transport-kernel-standalone-publish-blocked.ts");
    expect(charter).toContain("W58+");
  });

  it("implements fail-closed policy in publish-port", () => {
    const policy = readFromPwa("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(policy).toContain("shouldBlockStandaloneLegacyPublishFallback");
    expect(policy).toContain("isStandaloneLegacyDeletionEnvApprovedForPolicy");
  });

  it("wires blocked fallback via subtracted port delegation (W63 rehearsal)", () => {
    const port = readFromPwa("app/features/relays/hooks/relay-standalone-publish-port.ts");
    expect(port).toContain("shouldRouteSubtractedStandalonePublishPort");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
  });

  it("blocks subtraction while recorded sign-off is BLOCKED", () => {
    const recorded = readFromRepo("docs/handoffs/transport-engine-smoke-sign-off-recorded.md");
    expect(parseSmokeSignOffDecision(recorded)).toBe("BLOCKED");
    expect(isStandaloneLegacyDeletionApproved(recorded)).toBe(false);
    expect(shouldBlockStandaloneLegacyPublishFallback()).toBe(false);
  });

  it("keeps legacy module and facade on disk while gate is closed", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish-legacy.ts"))).toBe(true);
    expect(existsSync(join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-standalone-publish.ts"))).toBe(true);
  });
});

describe("transport-engine w57 — blocked publish semantics", () => {
  it("returns fail-closed single-relay result with blocked message", async () => {
    const { publishStandaloneLegacyBlockedToRelay } = await import(
      "@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked"
    );
    const result = await publishStandaloneLegacyBlockedToRelay("wss://relay.example", "payload");
    expect(result.success).toBe(false);
    expect(result.error).toBe(STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE);
  });

  it("returns quorum-mapped multi-relay failure when deletion env blocks legacy", async () => {
    const { publishStandaloneLegacyBlockedToRelayUrls } = await import(
      "@/app/features/transport-kernel/transport-kernel-standalone-publish-blocked"
    );
    const result = await publishStandaloneLegacyBlockedToRelayUrls(
      ["wss://relay-1.example", "wss://relay-2.example"],
      "payload",
    );
    expect(result.success).toBe(false);
    expect(result.metQuorum).toBe(false);
    expect(result.overallError).toContain(STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE);
  });

  it("enables blocked fallback only when deletion approval env is on", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED", "1");
    expect(shouldBlockStandaloneLegacyPublishFallback()).toBe(true);
    vi.unstubAllEnvs();
    expect(shouldBlockStandaloneLegacyPublishFallback()).toBe(false);
  });
});
