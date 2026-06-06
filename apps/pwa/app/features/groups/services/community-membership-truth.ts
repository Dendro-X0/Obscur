/**
 * Single owner for workspace community membership truth (Path B).
 *
 * Coordination directory materialization is authoritative for active/left/expelled
 * when managed_workspace + coordination is configured. Monotonic relay OR-sets are
 * not used as membership truth on that path.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import {
  loadCoordinationMembershipDirectory,
  refreshCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { createEmptyCoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { isCoordinationConfigured } from "./community-membership-sync-mode";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";

export type CommunityMembershipTruthSyncStatus =
  | "unconfigured"
  | "not_workspace"
  | "loading"
  | "fresh"
  | "stale";

export type CommunityMembershipTruthSnapshot = Readonly<{
  syncStatus: CommunityMembershipTruthSyncStatus;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  inviteBlocklistPubkeys: ReadonlyArray<PublicKeyHex>;
}>;

const emptySnapshot = (syncStatus: CommunityMembershipTruthSyncStatus): CommunityMembershipTruthSnapshot => ({
  syncStatus,
  coordinationDirectory: null,
  activeMemberPubkeys: [],
  leftMemberPubkeys: [],
  expelledMemberPubkeys: [],
  inviteBlocklistPubkeys: [],
});

export const usesCoordinationMembershipTruth = (
  communityMode?: CommunityMode | null,
): boolean => (
  shouldUseCoordinationMembershipAuthority(communityMode) && isCoordinationConfigured()
);

export const readCommunityMembershipTruthSnapshot = (params: Readonly<{
  communityId: string;
  communityMode?: CommunityMode | null;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
}>): CommunityMembershipTruthSnapshot => {
  const communityId = params.communityId.trim();
  if (!communityId) {
    return emptySnapshot("stale");
  }

  if (!usesCoordinationMembershipTruth(params.communityMode)) {
    return emptySnapshot("not_workspace");
  }

  if (!isCoordinationConfigured()) {
    return emptySnapshot("unconfigured");
  }

  const coordinationDirectory = loadCoordinationMembershipDirectory(communityId, params.profileId);
  if (!coordinationDirectory) {
    return emptySnapshot("stale");
  }

  const activeMemberPubkeys = ensureLocalMemberInActive({
    activeMemberPubkeys: coordinationDirectory.activeMemberPubkeys,
    leftMemberPubkeys: coordinationDirectory.leftMemberPubkeys,
    expelledMemberPubkeys: coordinationDirectory.expelledMemberPubkeys,
    localMemberPubkey: params.localMemberPubkey,
  });

  return {
    syncStatus: "fresh",
    coordinationDirectory,
    activeMemberPubkeys,
    leftMemberPubkeys: coordinationDirectory.leftMemberPubkeys,
    expelledMemberPubkeys: coordinationDirectory.expelledMemberPubkeys,
    inviteBlocklistPubkeys: activeMemberPubkeys,
  };
};

const ensureLocalMemberInActive = (params: Readonly<{
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
}>): ReadonlyArray<PublicKeyHex> => {
  const local = params.localMemberPubkey?.trim();
  if (!local) {
    return params.activeMemberPubkeys;
  }
  const localNorm = local.toLowerCase();
  const isTerminal = [...params.leftMemberPubkeys, ...params.expelledMemberPubkeys]
    .some((pubkey) => pubkey.trim().toLowerCase() === localNorm);
  if (isTerminal) {
    return params.activeMemberPubkeys;
  }
  if (params.activeMemberPubkeys.some((pubkey) => pubkey.trim().toLowerCase() === localNorm)) {
    return params.activeMemberPubkeys;
  }
  return [...params.activeMemberPubkeys, local as PublicKeyHex];
};

export const refreshCommunityMembershipTruth = async (params: Readonly<{
  communityId: string;
  communityMode?: CommunityMode | null;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
  forceFull?: boolean;
}>): Promise<CommunityMembershipTruthSnapshot> => {
  const communityId = params.communityId.trim();
  if (!usesCoordinationMembershipTruth(params.communityMode) || !communityId) {
    return readCommunityMembershipTruthSnapshot(params);
  }

  const materialization = await refreshCoordinationMembershipDirectory({
    communityId,
    profileId: params.profileId,
    forceFull: params.forceFull === true,
  });

  if (!materialization) {
    return readCommunityMembershipTruthSnapshot(params);
  }

  return readCommunityMembershipTruthSnapshot({
    ...params,
    communityId,
  });
};

/** Path B B1: relay/chat hybrids must not widen workspace roster when directory is stale. */
export const mergeHybridMembershipTruthFallback = (params: Readonly<{
  truth: CommunityMembershipTruthSnapshot;
  hybridActiveMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
}>): CommunityMembershipTruthSnapshot => params.truth;

export const createEmptyCommunityMembershipTruth = (): CommunityMembershipTruthSnapshot => ({
  ...emptySnapshot("stale"),
  coordinationDirectory: createEmptyCoordinationMembershipMaterialization(),
});
