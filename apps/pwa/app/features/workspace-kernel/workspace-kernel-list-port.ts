import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";

export type WorkspaceKernelListPortStatus = "w1_landed";

export const workspaceKernelListPortStatus = (): WorkspaceKernelListPortStatus => "w1_landed";

export type WorkspaceKernelMembershipListRow = Readonly<{
  communityId: string;
  materialization: CoordinationMembershipMaterialization;
  updatedAtUnixMs: number;
}>;

/** Sidebar/list input derived from coordination directory only (W1). */
export const listManagedWorkspaceMembershipRows = (
  profileId?: string,
): ReadonlyArray<WorkspaceKernelMembershipListRow> => (
  listCoordinationMembershipDirectoryRecords(profileId)
);

export const isPubkeyActiveInManagedWorkspace = (
  row: WorkspaceKernelMembershipListRow,
  pubkey: PublicKeyHex,
): boolean => {
  const normalized = pubkey.trim().toLowerCase();
  return row.materialization.activeMemberPubkeys.some((entry) => entry.trim().toLowerCase() === normalized);
};
