import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipDeltaRecord } from "./community-coordination-membership-client";
import {
  applyCoordinationMembershipDeltaToMaterialization,
  createEmptyCoordinationMembershipMaterialization,
  materializeCoordinationMembershipFromDeltas,
} from "./community-coordination-membership-materializer";

const PK_A = "aa".repeat(32) as PublicKeyHex;
const PK_B = "bb".repeat(32) as PublicKeyHex;

const delta = (
  seq: number,
  action: "join" | "leave" | "expel",
  subjectPubkey: PublicKeyHex,
): CoordinationMembershipDeltaRecord => ({
  deltaId: `delta-${seq}`,
  communityId: "community-1",
  seq,
  action,
  subjectPubkey,
  actorPubkey: subjectPubkey,
  createdAtUnixMs: seq * 1_000,
  signature: "sig",
});

describe("community-coordination-membership-materializer", () => {
  it("materializes join then leave so leaver is not active", () => {
    const materialized = materializeCoordinationMembershipFromDeltas([
      delta(1, "join", PK_A),
      delta(2, "join", PK_B),
      delta(3, "leave", PK_B),
    ]);
    expect(materialized.activeMemberPubkeys).toEqual([PK_A]);
    expect(materialized.leftMemberPubkeys).toEqual([PK_B]);
    expect(materialized.headSeq).toBe(3);
  });

  it("allows rejoin after leave via later join delta", () => {
    const materialized = materializeCoordinationMembershipFromDeltas([
      delta(1, "join", PK_B),
      delta(2, "leave", PK_B),
      delta(3, "join", PK_B),
    ]);
    expect(materialized.activeMemberPubkeys).toEqual([PK_B]);
    expect(materialized.leftMemberPubkeys).toEqual([]);
  });

  it("applies incremental delta updates without replaying full history", () => {
    const base = createEmptyCoordinationMembershipMaterialization();
    const afterJoin = applyCoordinationMembershipDeltaToMaterialization(base, delta(1, "join", PK_B));
    const afterLeave = applyCoordinationMembershipDeltaToMaterialization(afterJoin, delta(2, "leave", PK_B));
    expect(afterLeave.activeMemberPubkeys).toEqual([]);
    expect(afterLeave.leftMemberPubkeys).toEqual([PK_B]);
  });
});
