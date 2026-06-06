import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
  readMembershipSyncMode: vi.fn(() => "coordination_preferred" as const),
}));

import { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";
import { readMembershipSyncMode } from "./community-membership-sync-mode";
import {
  resolveWorkspaceActionMemberPubkeys,
  shouldUseCoordinationMembershipAuthority,
} from "./community-workspace-r1-policy";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PK_C = "cc".repeat(32) as PublicKeyHex;

describe("community-workspace-r1-policy", () => {
  beforeEach(() => {
    vi.mocked(isWorkspaceR1MembershipEnforced).mockReturnValue(true);
    vi.mocked(readMembershipSyncMode).mockReturnValue("coordination_preferred");
  });

  it("shouldUseCoordinationMembershipAuthority is true for managed_workspace when R1 on", () => {
    expect(shouldUseCoordinationMembershipAuthority("managed_workspace")).toBe(true);
    expect(shouldUseCoordinationMembershipAuthority("sovereign_room")).toBe(false);
  });

  it("uses coordination for managed_workspace when R1 on even if sync mode was nostr_only", () => {
    vi.mocked(readMembershipSyncMode).mockReturnValue("nostr_only");
    expect(shouldUseCoordinationMembershipAuthority("managed_workspace")).toBe(true);
  });

  it("resolveWorkspaceActionMemberPubkeys prefers coordination projection for managed_workspace", () => {
    const result = resolveWorkspaceActionMemberPubkeys({
      communityMode: "managed_workspace",
      coordinationProjectionPubkeys: [PK_A, PK_B],
      hybridActiveMemberPubkeys: [PK_A, PK_B, PK_C],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(result).toEqual([PK_A, PK_B]);
  });

  it("resolveWorkspaceActionMemberPubkeys does not fall back to hybrid when projection empty (Path B B1)", () => {
    const result = resolveWorkspaceActionMemberPubkeys({
      communityMode: "managed_workspace",
      coordinationProjectionPubkeys: [],
      hybridActiveMemberPubkeys: [PK_A],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(result).toEqual([]);
  });
});
