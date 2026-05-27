import type { MembershipStatePatch } from "@dweb/client-gateway";
import type { GroupMembershipStatus } from "../types";

export type SealedCommunityMembershipNip29Snapshot = Readonly<{
  leftMembers: ReadonlyArray<string>;
  expelledMembers: ReadonlyArray<string>;
  membership: Readonly<{ status: GroupMembershipStatus; role: string }>;
  disbandedAt?: number;
}>;

export const applySealedCommunityMembershipStatePatch = <T extends SealedCommunityMembershipNip29Snapshot>(
  prev: T,
  patch: MembershipStatePatch | undefined,
): T => {
  if (!patch) {
    return prev;
  }
  return {
    ...prev,
    ...(patch.leftMembers !== undefined ? { leftMembers: [...patch.leftMembers] } : {}),
    ...(patch.expelledMembers !== undefined ? { expelledMembers: [...patch.expelledMembers] } : {}),
    ...(patch.membershipStatus !== undefined
      ? { membership: { ...prev.membership, status: patch.membershipStatus } }
      : {}),
    ...(patch.disbandedAtUnixMs !== undefined ? { disbandedAt: patch.disbandedAtUnixMs } : {}),
  };
};

export const toSealedCommunityMembershipStateSnapshot = (
  prev: SealedCommunityMembershipNip29Snapshot,
) => ({
  leftMembers: prev.leftMembers,
  expelledMembers: prev.expelledMembers,
  membershipStatus: prev.membership.status,
  disbandedAtUnixMs: prev.disbandedAt,
});
