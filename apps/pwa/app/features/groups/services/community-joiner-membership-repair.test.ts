import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

vi.mock("@/app/features/workspace-kernel/workspace-kernel-policy", () => ({
  isWorkspaceKernelAuthority: vi.fn(() => true),
}));

vi.mock("./strict-managed-workspace", () => ({
  isStrictManagedWorkspaceRelay: vi.fn((relayUrl?: string | null) => (
    (relayUrl ?? "").includes("localhost")
  )),
}));

import {
  evaluateJoinerMembershipRepairReadModels,
  evaluateJoinerMembershipRepairScenario,
  JOINER_MEMBERSHIP_REPAIR_LEGACY_GROUP,
  JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A,
  JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_B,
  JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY,
} from "./community-joiner-membership-repair-scenario";
import { enrichWorkspaceGroupConversation } from "./community-workspace-r1-policy";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";
import { usesCoordinationMembershipDirectory } from "./community-workspace-transport-policy";

describe("community joiner membership repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("infers managed_workspace for legacy join rows on local operator relay", () => {
    const enriched = enrichWorkspaceGroupConversation(JOINER_MEMBERSHIP_REPAIR_LEGACY_GROUP);
    expect(enriched.communityMode).toBe("managed_workspace");
    expect(shouldUseCoordinationMembershipAuthority(undefined, JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY)).toBe(true);
    expect(usesCoordinationMembershipDirectory(undefined, JOINER_MEMBERSHIP_REPAIR_SCENARIO_RELAY)).toBe(true);
  });

  it("shows both join-evidence members when coordination directory only has self", () => {
    const scenario = evaluateJoinerMembershipRepairReadModels();
    expect(scenario.ok).toBe(true);
    expect(scenario.displayPubkeys).toEqual([
      JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A,
      JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_B,
    ]);
  });

  it("blocks re-invite for join-evidence members when directory is stale", () => {
    const scenario = evaluateJoinerMembershipRepairReadModels();
    expect(scenario.blocklistPubkeys).toEqual([
      JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_A,
      JOINER_MEMBERSHIP_REPAIR_SCENARIO_PK_B,
    ]);
  });

  it("passes full scenario when managed_workspace is inferred on native kernel path", () => {
    const scenario = evaluateJoinerMembershipRepairScenario();
    expect(scenario.ok).toBe(true);
    expect(scenario.effectiveCommunityMode).toBe("managed_workspace");
  });
});
