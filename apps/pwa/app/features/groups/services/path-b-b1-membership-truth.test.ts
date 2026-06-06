import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { materializeCoordinationMembershipFromDeltas } from "./community-coordination-membership-materializer";
import { mergeHybridMembershipTruthFallback } from "./community-membership-truth";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: vi.fn(() => true),
}));

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;
const PK_C = "cc".repeat(32) as PublicKeyHex;

describe("Path B Band B1 membership truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mergeHybridMembershipTruthFallback does not widen stale roster from relay hybrids", () => {
    const staleTruth = {
      syncStatus: "stale" as const,
      coordinationDirectory: null,
      activeMemberPubkeys: [] as ReadonlyArray<PublicKeyHex>,
      leftMemberPubkeys: [] as ReadonlyArray<PublicKeyHex>,
      expelledMemberPubkeys: [] as ReadonlyArray<PublicKeyHex>,
      inviteBlocklistPubkeys: [] as ReadonlyArray<PublicKeyHex>,
    };
    const merged = mergeHybridMembershipTruthFallback({
      truth: staleTruth,
      hybridActiveMemberPubkeys: [PK_A, PK_B, PK_C],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(merged).toBe(staleTruth);
    expect(merged.activeMemberPubkeys).toEqual([]);
  });

  it("leave delta shrinks coordination materialized roster (K-M1 directory path)", () => {
    const materialized = materializeCoordinationMembershipFromDeltas([
      {
        deltaId: "d1",
        communityId: "c1",
        seq: 1,
        action: "join",
        subjectPubkey: PK_A,
        actorPubkey: PK_A,
        createdAtUnixMs: 1,
        signature: "sig1",
      },
      {
        deltaId: "d2",
        communityId: "c1",
        seq: 2,
        action: "join",
        subjectPubkey: PK_B,
        actorPubkey: PK_B,
        createdAtUnixMs: 2,
        signature: "sig2",
      },
      {
        deltaId: "d3",
        communityId: "c1",
        seq: 3,
        action: "leave",
        subjectPubkey: PK_B,
        actorPubkey: PK_B,
        createdAtUnixMs: 3,
        signature: "sig3",
      },
    ]);
    expect(materialized.activeMemberPubkeys).toEqual([PK_A]);
    expect(materialized.leftMemberPubkeys).toEqual([PK_B]);
    expect(materialized.headSeq).toBe(3);
  });
});
