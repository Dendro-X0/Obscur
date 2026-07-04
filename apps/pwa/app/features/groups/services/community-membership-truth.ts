/**
 * Single owner for workspace community membership truth (Path B).
 *
 * Coordination directory materialization is authoritative for active/left/expelled
 * when managed_workspace + coordination is configured. Monotonic relay OR-sets are
 * not used as membership truth on that path.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { CommunityMode } from "../types";
import {
  loadCoordinationMembershipDirectory,
  refreshCoordinationMembershipDirectory,
} from "./community-coordination-membership-directory-store";
import type { CoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { createEmptyCoordinationMembershipMaterialization } from "./community-coordination-membership-materializer";
import { isCoordinationConfigured } from "./community-membership-sync-mode";
import { shouldUseCoordinationMembershipAuthority } from "./community-workspace-r1-policy";
import {
  findJoinedLedgerEntryForCommunity,
} from "@/app/features/workspace-kernel/workspace-kernel-membership-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { loadCommunityMembershipLedger } from "./community-membership-ledger";

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
  relayUrl?: string | null,
): boolean => (
  shouldUseCoordinationMembershipAuthority(communityMode, relayUrl) && isCoordinationConfigured()
);

export const readCommunityMembershipTruthSnapshot = (params: Readonly<{
  communityId: string;
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  profileId?: string;
  localMemberPubkey?: PublicKeyHex | null;
}>): CommunityMembershipTruthSnapshot => {
  const communityId = params.communityId.trim();
  if (!communityId) {
    return emptySnapshot("stale");
  }

  if (!usesCoordinationMembershipTruth(params.communityMode, params.relayUrl)) {
    return emptySnapshot("not_workspace");
  }

  if (!isCoordinationConfigured()) {
    return emptySnapshot("unconfigured");
  }

  const coordinationDirectory = loadCoordinationMembershipDirectory(communityId, params.profileId);
  if (!coordinationDirectory) {
    const localMemberPubkey = params.localMemberPubkey?.trim();
    if (localMemberPubkey) {
      const ledger = loadCommunityMembershipLedger(localMemberPubkey as PublicKeyHex, {
        profileId: params.profileId ?? getResolvedProfileId(),
      });
      const ledgerEntry = findJoinedLedgerEntryForCommunity(ledger, communityId);
      if (ledgerEntry) {
        const ledgerMembers = (ledgerEntry.memberPubkeys ?? []).map((pubkey) => pubkey as PublicKeyHex);
        const activeMemberPubkeys = ledgerMembers.some((pubkey) => (
          pubkey.trim().toLowerCase() === localMemberPubkey.toLowerCase()
        ))
          ? ledgerMembers
          : [localMemberPubkey as PublicKeyHex, ...ledgerMembers];
        return {
          syncStatus: "stale",
          coordinationDirectory: null,
          activeMemberPubkeys,
          leftMemberPubkeys: [],
          expelledMemberPubkeys: [],
          inviteBlocklistPubkeys: activeMemberPubkeys,
        };
      }
    }
    return emptySnapshot("stale");
  }

  let activeMemberPubkeys = ensureLocalMemberInActive({
    activeMemberPubkeys: coordinationDirectory.activeMemberPubkeys,
    leftMemberPubkeys: coordinationDirectory.leftMemberPubkeys,
    expelledMemberPubkeys: coordinationDirectory.expelledMemberPubkeys,
    localMemberPubkey: params.localMemberPubkey,
  });

  const localMemberPubkey = params.localMemberPubkey?.trim();
  if (localMemberPubkey) {
    const ledger = loadCommunityMembershipLedger(localMemberPubkey as PublicKeyHex, {
      profileId: params.profileId ?? getResolvedProfileId(),
    });
    const ledgerEntry = findJoinedLedgerEntryForCommunity(ledger, communityId);
    const ledgerMembers = (ledgerEntry?.memberPubkeys ?? []).map((pubkey) => pubkey as PublicKeyHex);
    if (ledgerMembers.length > activeMemberPubkeys.length) {
      const terminal = new Set([
        ...coordinationDirectory.leftMemberPubkeys,
        ...coordinationDirectory.expelledMemberPubkeys,
      ].map((pubkey) => pubkey.trim().toLowerCase()));
      const activeNorm = new Set(activeMemberPubkeys.map((pubkey) => pubkey.trim().toLowerCase()));
      const repairMembers = ledgerMembers.filter((pubkey) => {
        const normalized = pubkey.trim().toLowerCase();
        return normalized.length > 0 && !terminal.has(normalized) && !activeNorm.has(normalized);
      });
      if (repairMembers.length > 0) {
        activeMemberPubkeys = [...activeMemberPubkeys, ...repairMembers];
      }
    }
  }

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
  localPrivateKeyHex?: PrivateKeyHex | null;
  groupId?: string;
  forceFull?: boolean;
}>): Promise<CommunityMembershipTruthSnapshot> => {
  const communityId = params.communityId.trim();
  if (!usesCoordinationMembershipTruth(params.communityMode) || !communityId) {
    return readCommunityMembershipTruthSnapshot(params);
  }

  const roomKeyMaterialization = params.localMemberPubkey?.trim() && params.localPrivateKeyHex
    ? {
      localPubkey: params.localMemberPubkey,
      localPrivateKeyHex: params.localPrivateKeyHex,
      ...(params.groupId?.trim() ? { groupId: params.groupId.trim() } : {}),
    }
    : undefined;

  const materialization = await refreshCoordinationMembershipDirectory({
    communityId,
    profileId: params.profileId,
    forceFull: params.forceFull === true,
    roomKeyMaterialization,
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
