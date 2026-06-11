import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupConversation } from "@/app/features/messaging/types";
import type { CoordinationMembershipMaterialization } from "@/app/features/groups/services/community-coordination-membership-materializer";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";
import {
  loadCommunityMembershipLedger,
  toGroupConversationFromMembershipLedgerEntry,
} from "@/app/features/groups/services/community-membership-ledger";
import { communityMembershipScopeMatchesStorageKey } from "@/app/features/groups/services/community-membership-scope-key";
import { isGroupTombstoned, loadGroupTombstones } from "@/app/features/groups/services/group-tombstone-store";
import { enrichWorkspaceGroupConversation } from "@/app/features/groups/services/community-workspace-r1-policy";
import { hasTerminalLedgerScopeEvidence } from "./workspace-kernel-membership-scope";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";

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

const isScopeTombstoned = (
  tombstones: ReadonlySet<string>,
  groupId: string,
  relayUrl: string,
): boolean => (
  Array.from(tombstones).some((tombstoneKey) => (
    communityMembershipScopeMatchesStorageKey({ groupId, relayUrl }, tombstoneKey)
  ))
);

const shouldHideFromSidebar = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  groupId: string;
  relayUrl: string;
  tombstones: ReadonlySet<string>;
}>): boolean => {
  const groupId = params.groupId.trim();
  const relayUrl = params.relayUrl.trim();
  if (!groupId || !relayUrl) {
    return true;
  }
  if (isGroupTombstoned(params.publicKeyHex, { groupId, relayUrl }, { profileId: params.profileId })) {
    return true;
  }
  if (isScopeTombstoned(params.tombstones, groupId, relayUrl)) {
    return true;
  }
  const ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  return hasTerminalLedgerScopeEvidence(ledger, { groupId, relayUrl });
};

/**
 * W1 list-port — sidebar rows from local metadata + joined ledger only.
 * Coordination directory governs roster/send gates, not whether a row exists locally.
 */
export const resolveManagedWorkspaceGroupList = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  persistedGroups: ReadonlyArray<GroupConversation>;
}>): ReadonlyArray<GroupConversation> => {
  if (!isWorkspaceKernelAuthority()) {
    return params.persistedGroups;
  }

  const tombstones = loadGroupTombstones(params.publicKeyHex, { profileId: params.profileId });
  const ledger = loadCommunityMembershipLedger(params.publicKeyHex, { profileId: params.profileId });
  const byConversationId = new Map<string, GroupConversation>();

  const rememberGroup = (group: GroupConversation): void => {
    const groupId = group.groupId?.trim() ?? "";
    const relayUrl = group.relayUrl?.trim() ?? "";
    if (shouldHideFromSidebar({
      publicKeyHex: params.publicKeyHex,
      profileId: params.profileId,
      groupId,
      relayUrl,
      tombstones,
    })) {
      return;
    }
    byConversationId.set(group.id, enrichWorkspaceGroupConversation(group));
  };

  for (const group of params.persistedGroups) {
    rememberGroup(group);
  }

  for (const ledgerEntry of ledger) {
    if (ledgerEntry.status !== "joined") {
      continue;
    }
    const groupId = ledgerEntry.groupId.trim();
    const relayUrl = (ledgerEntry.relayUrl ?? "").trim();
    if (Array.from(byConversationId.values()).some((group) => (
      group.groupId.trim() === groupId && (group.relayUrl ?? "").trim() === relayUrl
    ))) {
      continue;
    }
    rememberGroup(toGroupConversationFromMembershipLedgerEntry(ledgerEntry));
  }

  return Array.from(byConversationId.values());
};

/** @deprecated Use {@link resolveManagedWorkspaceGroupList}. */
export const reconcileWorkspaceKernelCreatedGroups = resolveManagedWorkspaceGroupList;
