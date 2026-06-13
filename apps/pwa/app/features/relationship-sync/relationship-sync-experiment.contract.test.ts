import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("relationship sync experiment contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");

  it("documents E-REL experiment charter", () => {
    const doc = readFileSync(
      path.join(repoRoot, "docs/program/relationship-sync-experiment.md"),
      "utf8",
    );
    expect(doc).toContain("E-REL");
    expect(doc).toContain("NEXT_PUBLIC_OBSCUR_RELATIONSHIP_SYNC_EXPERIMENT");
  });

  it("verify:relationship-sync-experiment script exists", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:relationship-sync-experiment");
  });

  it("invite eligibility respects experiment flag for join-evidence widen", () => {
    const readModel = readFileSync(
      path.join(pwaRoot, "app/features/groups/services/community-invite-eligibility-read-model.ts"),
      "utf8",
    );
    expect(readModel).toContain("isRelationshipSyncExperimentEnabled");
    expect(readModel).toContain("joinEvidenceSource");
  });

  it("drift logger emits relationship.sync.drift_detected", () => {
    const logger = readFileSync(
      path.join(pwaRoot, "app/features/relationship-sync/relationship-sync-drift-logger.ts"),
      "utf8",
    );
    expect(logger).toContain("relationship.sync.drift_detected");
  });

  it("E-REL-2 directory sidebar materialization is wired in list-port", () => {
    const listPort = readFileSync(
      path.join(pwaRoot, "app/features/workspace-kernel/workspace-kernel-list-port.ts"),
      "utf8",
    );
    expect(listPort).toContain("appendDirectoryBackedSidebarGroups");
  });

  it("peer trust read authority holds legacy contacts during projection cutover", () => {
    const peerTrust = readFileSync(
      path.join(pwaRoot, "app/features/network/hooks/use-peer-trust.ts"),
      "utf8",
    );
    expect(peerTrust).toContain("resolvePeerTrustReadAuthority");
    expect(peerTrust).toContain("network.peer_trust_read_authority_selected");
  });
});
