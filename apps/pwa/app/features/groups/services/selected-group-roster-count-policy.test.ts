/**
 * R2 — chat shell member count prefers monotonic read model over thinned relay snapshot.
 */
import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { dedupeCommunityMemberPubkeys } from "./community-member-roster-projection";

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
const PK_C = "c".repeat(64) as PublicKeyHex;

const resolveSelectedGroupActiveMemberPubkeys = (params: Readonly<{
  r2DisplayPubkeys: ReadonlyArray<PublicKeyHex>;
  sealedCommunityMembers: ReadonlyArray<PublicKeyHex>;
  projectionActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): ReadonlyArray<PublicKeyHex> => {
  const leftSet = new Set(
    (params.leftMemberPubkeys ?? []).map((pubkey) => pubkey.trim().toLowerCase()),
  );
  const isActive = (pubkey: PublicKeyHex): boolean => {
    const normalized = pubkey.trim().toLowerCase();
    return normalized.length > 0 && !leftSet.has(normalized);
  };

  const r2Active = params.r2DisplayPubkeys.filter(isActive);
  if (r2Active.length > 0) {
    const liveActive = params.sealedCommunityMembers.filter(isActive);
    if (liveActive.length > r2Active.length) {
      return dedupeCommunityMemberPubkeys([...r2Active, ...liveActive]);
    }
    return r2Active;
  }
  const liveActive = params.sealedCommunityMembers.filter(isActive);
  if (liveActive.length > 0) {
    return liveActive;
  }
  return params.projectionActiveMemberPubkeys.filter(isActive);
};

describe("selected group roster count policy (R2)", () => {
  it("prefers R2 read model when relay snapshot thins to one member", () => {
    const active = resolveSelectedGroupActiveMemberPubkeys({
      r2DisplayPubkeys: [PK_A, PK_B, PK_C],
      sealedCommunityMembers: [PK_A],
      projectionActiveMemberPubkeys: [PK_A],
    });
    expect(active).toHaveLength(3);
    expect(active).toEqual(expect.arrayContaining([PK_B, PK_C]));
  });

  it("widens R2 when relay reports a new active member", () => {
    const PK_D = "d".repeat(64) as PublicKeyHex;
    const active = resolveSelectedGroupActiveMemberPubkeys({
      r2DisplayPubkeys: [PK_A, PK_B],
      sealedCommunityMembers: [PK_A, PK_B, PK_D],
      projectionActiveMemberPubkeys: [PK_A],
    });
    expect(active).toHaveLength(3);
    expect(active).toEqual(expect.arrayContaining([PK_D]));
  });
});
