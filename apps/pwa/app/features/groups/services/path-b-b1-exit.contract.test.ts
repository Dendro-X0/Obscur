import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B1-1 exit contract — coordination-only roster for managed_workspace;
 * hybrid relay widen disabled when directory is stale or missing.
 */
describe("path B B1-1 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("membership truth owner documents coordination-only authority", () => {
    const truth = read("app/features/groups/services/community-membership-truth.ts");
    expect(truth).toContain("Single owner for workspace community membership truth");
    expect(truth).toContain("usesCoordinationMembershipTruth");
    expect(truth).toContain('syncStatus: "fresh"');
    expect(truth).toContain('emptySnapshot("stale")');
  });

  it("mergeHybridMembershipTruthFallback is a no-op (relay widen disabled)", () => {
    const truth = read("app/features/groups/services/community-membership-truth.ts");
    expect(truth).toContain("mergeHybridMembershipTruthFallback");
    expect(truth).toContain("relay/chat hybrids must not widen workspace roster");
    expect(truth).toMatch(/mergeHybridMembershipTruthFallback[\s\S]*?=>\s*params\.truth/);
  });

  it("workspace action pubkeys do not fall back to hybrid roster", () => {
    const policy = read("app/features/groups/services/community-workspace-r1-policy.ts");
    expect(policy).toContain("resolveWorkspaceActionMemberPubkeys");
    expect(policy).toContain("No relay/chat hybrid widen");
    expect(policy).toContain("coordinationProjectionPubkeys ?? []");
  });

  it("participant display returns empty when coordination directory is missing", () => {
    const display = read("app/features/groups/services/community-participant-display-read-model.ts");
    expect(display).toContain("usesCoordinationMembershipTruth");
    expect(display).toContain("return []");
    expect(display).toContain("monotonicDisplayPubkeys");
  });

  it("invite blocklist uses coordination directory and directory repair for managed_workspace", () => {
    const invite = read("app/features/groups/services/community-invite-eligibility-read-model.ts");
    expect(invite).toContain("shouldUseCoordinationMembershipAuthority");
    expect(invite).toContain("joinEvidenceMemberPubkeys");
    expect(invite).toContain("buildCoordinationDirectoryRepairMemberPubkeys");
    expect(invite).toContain("membershipRepairs");
    expect(invite).toContain("dedupePubkeys([...fromDirectory, ...membershipRepairs])");
  });

  it("path-b-b1 membership truth tests cover leave shrink and hybrid no-op", () => {
    const tests = read("app/features/groups/services/path-b-b1-membership-truth.test.ts");
    expect(tests).toContain("does not widen stale roster from relay hybrids");
    expect(tests).toContain('action: "leave"');
    expect(tests).toMatch(/expect\(materialized\.activeMemberPubkeys\)\.toEqual\(\[PK_A\]\)/);
  });
});
